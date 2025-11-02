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
  - name: "{{ g.name }}"
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

{% elif request.target == "loon" %}
# Loon 输出配置
[General]
allow-lan = true
dns-server = system
network_check_url = http://connectivitycheck.gstatic.com/generate_204

[Proxy Group]
{% for g in local.custom_proxy_group %}
{% set proxies = "" %}
{% for p in g.proxies %}
  {% if loop.first %}
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

{% elif request.target == "quanx" %}
# Quantumult X 输出配置
[general]
server_check_url = http://connectivitycheck.gstatic.com/generate_204
dns-server = system

[policy]
{% for g in local.custom_proxy_group %}
{% set proxies = "" %}
{% for p in g.proxies %}
  {% if loop.first %}
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
# 未识别的目标类型: {{ request.target }}
{% endif %}
