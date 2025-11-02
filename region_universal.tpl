{# =====================================================
 region_universal.tpl
 通用模板：支持 Clash / Loon / Quantumult X
===================================================== #}

{% if request.target == "clash" %}
# Clash 输出配置
port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
external-controller: 127.0.0.1:9090

proxy-groups:
{% for g in local.custom_proxy_group %}
  - name: {{ g.name }}
    type: {{ g.type }}
    {% if g.url %}url: {{ g.url }}{% endif %}
    {% if g.interval %}interval: {{ g.interval }}{% endif %}
    {% if g.proxies %}
    proxies:
      {% for p in g.proxies %}
      - {{ p }}
      {% endfor %}
    {% endif %}
{% endfor %}

rules:
{% for r in local.ruleset %}
  - {{ r }}
{% endfor %}

{% else %}
  {% if request.target == "loon" %}
# Loon 输出配置
[General]
allow-lan = true
dns-server = system

[Proxy Group]
{% for g in local.custom_proxy_group %}
{% set proxies = "" %}
{% for p in g.proxies %}
  {% if loop.index0 == 0 %}
    {% set proxies = p %}
  {% else %}
    {% set proxies = proxies + ", " + p %}
  {% endif %}
{% endfor %}
{{ g.name }} = {{ g.type }}, {{ proxies }}
{% endfor %}

[Rule]
{% for r in local.ruleset %}
{{ r }}
{% endfor %}

  {% else %}
    {% if request.target == "quanx" %}
# Quantumult X 输出配置
[general]
dns-server = system

[policy]
{% for g in local.custom_proxy_group %}
{% set proxies = "" %}
{% for p in g.proxies %}
  {% if loop.index0 == 0 %}
    {% set proxies = p %}
  {% else %}
    {% set proxies = proxies + ", " + p %}
  {% endif %}
{% endfor %}
{{ g.name }} = {{ g.type }}, {{ proxies }}
{% endfor %}

[filter_remote]
{% for r in local.ruleset %}
{{ r }}
{% endfor %}
    {% else %}
# 未识别的 target: {{ request.target }}
    {% endif %}
  {% endif %}
{% endif %}
