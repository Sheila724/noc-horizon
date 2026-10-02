// Globo 3D (projeção ortográfica do D3) com auto-rotação, arraste manual,
// linhas de grande círculo entre os nós e partículas viajando nelas.
const InfraMap = (() => {
  let svg, g, projection, path;
  let landGroup, linesGroup, particlesGroup, nodesGroup;
  let rotation = [10, -15];
  let autoRotate = true;
  let resumeTimer = null;
  let resizeTimer = null;
  let currentLocations = [];
  let onNodeClickCallback = null;
  let particles = [];

  function computeDimensions() {
    const rect = svg.node().getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    return { width, height };
  }

  function setup(onWorldLoaded) {
    svg = d3.select("#map");
    const { width, height } = computeDimensions();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const scale = Math.min(width, height) / 2.5;
    projection = d3.geoOrthographic()
      .scale(scale)
      .translate([width / 2, height / 2 + 6])
      .clipAngle(90)
      .rotate(rotation);

    path = d3.geoPath(projection);
    g = svg.append("g");

    const defs = svg.append("defs");
    const grad = defs.append("radialGradient")
      .attr("id", "globe-gradient")
      .attr("cx", "35%")
      .attr("cy", "35%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#1c3568");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#050b1c");

    g.append("path")
      .datum({ type: "Sphere" })
      .attr("class", "globe-sphere")
      .attr("fill", "url(#globe-gradient)");

    g.append("path")
      .datum(d3.geoGraticule10())
      .attr("class", "graticule");

    landGroup = g.append("g").attr("class", "land-group");
    linesGroup = g.append("g").attr("class", "lines-group");
    particlesGroup = g.append("g").attr("class", "particles-group");
    nodesGroup = g.append("g").attr("class", "nodes-group");

    d3.json(CONFIG.WORLD_ATLAS_URL)
      .then(worldData => {
        const countries = topojson.feature(worldData, worldData.objects.countries);
        landGroup.selectAll("path")
          .data(countries.features)
          .join("path")
          .attr("class", "land");
        onWorldLoaded();
      })
      .catch(err => {
        console.error("Falha ao carregar o mapa-múndi:", err);
        onWorldLoaded();
      });

    setupDrag();
    setupResize();
    d3.timer(tick);
  }

  function setupResize() {
    function handleResize() {
      const { width, height } = computeDimensions();
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      const scale = Math.min(width, height) / 2.5;
      projection.scale(scale).translate([width / 2, height / 2 + 6]);
    }

    function debouncedResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 150);
    }

    window.addEventListener("resize", debouncedResize);
  }

  function setupDrag() {
    function scheduleResume() {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { autoRotate = true; }, 4000);
    }

    svg.call(
      d3.drag()
        .on("start", () => {
          autoRotate = false;
          scheduleResume();
        })
        .on("drag", event => {
          const k = 60 / projection.scale();
          rotation[0] += event.dx * k;
          rotation[1] = Math.max(-90, Math.min(90, rotation[1] - event.dy * k));
          projection.rotate(rotation);
          scheduleResume();
        })
        .on("end", () => {
          scheduleResume();
        })
    );
  }

  function tick() {
    if (autoRotate) {
      rotation[0] += 0.05;
      projection.rotate(rotation);
    }
    render();
    advanceParticles();
  }

  function isFront([lon, lat]) {
    const r = projection.rotate();
    const center = [-r[0], -r[1]];
    return d3.geoDistance([lon, lat], center) < Math.PI / 2;
  }

  function worstOf(a, b) {
    const order = (CONFIG && CONFIG.STATUS_ORDER) || ["ok", "warning", "attention", "critical"];
    const ai = order.indexOf(a || "ok");
    const bi = order.indexOf(b || "ok");
    return order[Math.max(ai, bi, 0)];
  }

  function render() {
    g.select(".globe-sphere").attr("d", path);
    g.select(".graticule").attr("d", path);
    landGroup.selectAll("path").attr("d", path);
    drawConnections();
    drawParticlesLayer();
    drawNodes();
  }

  // Liga cada local aos seus vizinhos mais próximos. Com poucos locais vira
  // uma malha completa; com muitos, evita uma "teia" ilegível no globo.
  const MAX_NEIGHBORS = 2;
  function buildPairs() {
    const locs = currentLocations;
    const seen = new Set();
    const pairs = [];
    locs.forEach((a, i) => {
      locs
        .map((b, j) => ({ j, d: d3.geoDistance([a.lon, a.lat], [b.lon, b.lat]) }))
        .filter(x => x.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, MAX_NEIGHBORS)
        .forEach(({ j }) => {
          const [lo, hi] = i < j ? [i, j] : [j, i];
          const key = `${lo}-${hi}`;
          if (!seen.has(key)) {
            seen.add(key);
            pairs.push([locs[lo], locs[hi]]);
          }
        });
    });
    return pairs;
  }

  function drawConnections() {
    const pairs = buildPairs();
    const lines = pairs.map(([a, b]) => ({
      type: "LineString",
      coordinates: [[a.lon, a.lat], [b.lon, b.lat]],
      status: worstOf(a.status, b.status),
    }));

    const sel = linesGroup.selectAll("path").data(lines);
    sel.exit().remove();
    sel.enter()
      .append("path")
      .attr("class", "conn-line")
      .merge(sel)
      .attr("d", path)
      .style("stroke", d => CONFIG.STATUS_COLOR[d.status])
      .style("color", d => CONFIG.STATUS_COLOR[d.status])
      .classed("flow", d => d.status !== "ok");
  }

  function buildParticles() {
    const pairs = buildPairs();
    particles = [];
    pairs.forEach(([a, b]) => {
      const status = worstOf(a.status, b.status);
      const color = CONFIG.STATUS_COLOR[status];
      for (let k = 0; k < 2; k++) {
        particles.push({
          from: [a.lon, a.lat],
          to: [b.lon, b.lat],
          t: k / 2,
          speed: 0.0025,
          color,
        });
      }
    });
  }

  function advanceParticles() {
    particles.forEach(p => {
      p.t += p.speed;
      if (p.t > 1) p.t -= 1;
    });
  }

  function drawParticlesLayer() {
    const visible = particles
      .map(p => {
        const coord = d3.geoInterpolate(p.from, p.to)(p.t);
        return { ...p, coord, front: isFront(coord) };
      })
      .filter(p => p.front);

    const sel = particlesGroup.selectAll("circle").data(visible);
    sel.exit().remove();
    sel.enter()
      .append("circle")
      .attr("class", "particle")
      .attr("r", 2.2)
      .merge(sel)
      .attr("cx", d => projection(d.coord)[0])
      .attr("cy", d => projection(d.coord)[1])
      .style("fill", d => d.color)
      .style("color", d => d.color);
  }

  function drawNodes() {
    const visible = currentLocations.filter(d => isFront([d.lon, d.lat]));
    const sel = nodesGroup.selectAll(".node-group").data(visible, d => d.id);
    sel.exit().remove();

    const enter = sel
      .enter()
      .append("g")
      .attr("class", "node-group")
      .style("cursor", "pointer")
      .on("click", (event, d) => onNodeClickCallback && onNodeClickCallback(d));

    enter.append("circle").attr("class", "node-glow").attr("r", 14);
    enter.append("circle").attr("class", "node-pulse").attr("r", 8);
    enter.append("circle")
      .attr("class", "node-core")
      .attr("r", 6)
      .style("stroke", "#ffffffaa")
      .style("stroke-width", 1);
    enter.append("text")
      .attr("class", "node-label")
      .attr("y", -18)
      .attr("text-anchor", "middle");

    const merged = enter.merge(sel);
    merged.attr("transform", d => {
      const p = projection([d.lon, d.lat]);
      return `translate(${p[0]},${p[1]})`;
    });
    merged.select(".node-glow").style("fill", d => CONFIG.STATUS_COLOR[d.status]);
    merged.select(".node-pulse")
      .classed("animate", d => d.status !== "ok")
      .style("stroke", d => CONFIG.STATUS_COLOR[d.status]);
    merged.select(".node-core")
      .style("fill", d => CONFIG.STATUS_COLOR[d.status])
      .style("color", d => CONFIG.STATUS_COLOR[d.status]);
    merged.select(".node-label").text(d => d.label);
  }

  function renderNodes(locations, onNodeClick) {
    currentLocations = locations;
    onNodeClickCallback = onNodeClick;
    buildParticles();
    render();
  }

  return { setup, renderNodes };
})();
