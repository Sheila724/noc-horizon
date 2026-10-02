# Backend do NOC Horizon (Flask + Gunicorn)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY *.py ./

# Nunca rodar como root
RUN useradd --system --uid 10001 --no-create-home noc
USER noc

EXPOSE 5004

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5004/health', timeout=2)"

CMD ["gunicorn", "--workers", "2", "--bind", "0.0.0.0:5004", "--access-logfile", "-", "app:app"]
