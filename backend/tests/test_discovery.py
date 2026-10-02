"""Descoberta de locais pelo inventário do Zabbix (sem rede)."""

import discovery
from discovery import build_locations, get_locations

FALLBACK_MAP = {"legado-01": "matriz", "srv-sp-01": "matriz"}
FALLBACK_LOCATIONS = {"matriz": {"label": "Matriz", "lat": -20.5, "lon": -47.4}}


def host(name, location="", lat="", lon=""):
    return {
        "host": name,
        "name": name,
        "inventory": {"location": location, "location_lat": lat, "location_lon": lon},
    }


def test_hosts_com_mesmo_location_viram_um_ponto():
    hosts = [
        host("srv-sp-01", "São Paulo (BR)", "-23.55", "-46.63"),
        host("srv-sp-02", "São Paulo (BR)", "-23.57", "-46.65"),
        host("srv-rj-01", "Rio de Janeiro", "-22.90", "-43.20"),
    ]
    host_map, locations = build_locations(hosts, {}, {})
    assert host_map == {
        "srv-sp-01": "sao-paulo-br",
        "srv-sp-02": "sao-paulo-br",
        "srv-rj-01": "rio-de-janeiro",
    }
    assert locations["sao-paulo-br"]["label"] == "São Paulo (BR)"
    assert locations["sao-paulo-br"]["lat"] == -23.56  # média dos dois hosts


def test_aceita_virgula_decimal():
    host_map, locations = build_locations([host("a", "Curitiba", "-25,4284", "-49,2733")], {}, {})
    assert locations["curitiba"] == {"label": "Curitiba", "lat": -25.4284, "lon": -49.2733}


def test_ignora_coordenadas_vazias_invalidas_ou_fora_da_faixa():
    hosts = [
        host("vazio"),
        host("texto", "X", "abc", "10"),
        host("fora", "Y", "95", "10"),
        {"host": "sem-inventario", "name": "s", "inventory": []},  # inventário desativado
    ]
    host_map, locations = build_locations(hosts, {}, {})
    assert host_map == {} and locations == {}


def test_sem_location_usa_o_nome_do_host():
    _, locations = build_locations([host("vps-riga", "", "56.95", "24.11")], {}, {})
    assert locations["vps-riga"]["label"] == "vps-riga"


def test_fallback_para_o_config_quando_inventario_nao_tem_coordenadas():
    hosts = [host("srv-sp-01", "São Paulo (BR)", "-23.55", "-46.63"), host("legado-01")]
    host_map, locations = build_locations(hosts, FALLBACK_MAP, FALLBACK_LOCATIONS)
    assert host_map["srv-sp-01"] == "sao-paulo-br"  # inventário vence o config
    assert host_map["legado-01"] == "matriz"  # sem coordenadas -> config
    assert locations["matriz"]["label"] == "Matriz"


def test_cache_e_ultima_lista_boa_quando_o_zabbix_falha():
    discovery._cache.update(t=0.0, data=None)
    calls = []

    def fetch_ok():
        calls.append(1)
        return [host("a", "A", "1", "1")]

    first = get_locations(fetch_ok, {}, {}, ttl=300, now=1000)
    get_locations(fetch_ok, {}, {}, ttl=300, now=1100)  # dentro do TTL: não busca de novo
    assert len(calls) == 1

    def fetch_falha():
        raise RuntimeError("zabbix fora do ar")

    assert get_locations(fetch_falha, {}, {}, ttl=300, now=2000) == first


def test_sem_cache_e_zabbix_fora_usa_o_config():
    discovery._cache.update(t=0.0, data=None)

    def fetch_falha():
        raise RuntimeError("zabbix fora do ar")

    host_map, locations = get_locations(fetch_falha, FALLBACK_MAP, FALLBACK_LOCATIONS, 300, now=1)
    assert host_map == FALLBACK_MAP and locations == FALLBACK_LOCATIONS
