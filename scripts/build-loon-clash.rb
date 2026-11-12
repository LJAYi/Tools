#!/usr/bin/env ruby
# Rebuild the Mihomo adaptation from the repository's Loon policy bindings.
require 'yaml'

root = File.expand_path('..', __dir__)
sections = Hash.new { |h, k| h[k] = [] }
section = nil
File.foreach(File.join(root, 'Loon/Loon_Configuration.lcf')) do |line|
  line = line.strip
  if line =~ /^\[(.+)\]$/
    section = Regexp.last_match(1)
  elsif !line.empty? && !line.start_with?('#')
    sections[section] << line
  end
end

patterns = {
  '大陆' => '(?i)🇨🇳|回国|中国|上海|广州|北京|\b(CN|China)\d*\b',
  '香港' => '(?i)🇭🇰|香港|\b(HK|HKG|Hong)\d*\b',
  '日本' => '(?i)🇯🇵|日本|川日|东京|大阪|泉日|埼玉|\b(JP|JPN|Japan)\d*\b',
  '新国' => '(?i)🇸🇬|新加坡|狮|\b(SG|SGP|Singapore)\d*\b',
  '美国' => '(?i)🇺🇸|🇺🇲|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|\b(US|USA|United States)\d*\b',
  '游戏' => '(?i)游戏|🎮|\bGAME\d*\b',
  '全球' => '.+'
}
noise = '(?i)群|邀请|返利|官网|客服|订阅|流量|到期|过期|已用|联系|邮箱|工单|教程|关注|更新|作者|超时|\b(USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Traffic)\b'
node_filters = patterns.to_h do |region, pattern|
  exclude = ['大陆', '全球'].include?(region) ? noise : "#{noise}|回国|校园"
  exclude += '|(?i)游戏|🎮|\bGAME\b' unless region == '游戏' || ['大陆', '全球'].include?(region)
  ["#{region}节点", { 'include-all' => true, 'filter' => pattern, 'exclude-filter' => exclude }]
end
groups = []
sections['Proxy Group'].each do |line|
  name, value = line.split(/\s*=\s*/, 2)
  parts = value.split(',').map(&:strip)
  type = parts.shift
  members = parts.take_while { |part| !part.include?('=') }
  group = { 'name' => name, 'type' => type }
  node_members, policies = members.partition { |member| node_filters.key?(member) }
  abort "Multiple node filters in #{name}" if node_members.length > 1
  group.merge!(node_filters.fetch(node_members.first)) unless node_members.empty?
  group['proxies'] = policies unless policies.empty?
  if type != 'select'
    group.merge!('url' => 'https://www.gstatic.com/generate_204', 'interval' => 60, 'timeout' => 2000)
    group['tolerance'] = 50 if type == 'url-test'
    group['strategy'] = 'consistent-hashing' if type == 'load-balance'
  end
  icon = parts.find { |part| part.start_with?('img-url') }
  group['icon'] = icon.split('=', 2).last.strip if icon
  groups << group
end

providers = {}
finance_rules = []
app_rules = []
mapping = { 'AI' => %w[OpenAI Claude Gemini], 'SpeedtestInternational' => ['Speedtest'],
            'AppleAccount' => ['AppleID'], 'LAN_SPLITTER' => ['Lan'], 'REGION_SPLITTER' => ['ChinaMax'] }
sections['Remote Rule'].each do |line|
  url = line.split(',').first
  policy = line[/policy=([^,]+)/, 1].strip
  if url.include?('/Rule/Finance/')
    tag = File.basename(url, '.list')
    providers[tag] = { 'type' => 'http', 'behavior' => 'classical', 'format' => 'text',
                       'url' => url, 'path' => "./ruleset/loon/#{tag}.list", 'interval' => 86400 }
    finance_rules << "RULE-SET,#{tag},#{policy}"
  else
    original = File.basename(url, '.lsr')
    (mapping[original] || [original]).each do |tag|
      providers[tag] = { 'type' => 'http', 'behavior' => 'classical', 'format' => 'yaml',
                         'url' => "https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/#{tag}/#{tag}.yaml",
                         'path' => "./ruleset/loon/#{tag}.yaml", 'interval' => 86400 }
      app_rules << "RULE-SET,#{tag},#{policy}"
    end
  end
end
local = sections['Rule'].reject { |line| line.start_with?('FINAL,') }
names = groups.map { |group| group['name'] }
abort 'Duplicate policy group names' unless names.uniq == names
groups.each do |group|
  (group['proxies'] || []).each do |member|
    abort "Self-referencing policy: #{member}" if member == group['name']
    abort "Unknown policy: #{member}" unless names.include?(member) || member == 'DIRECT'
  end
end
(finance_rules + app_rules).each do |rule|
  _, tag, policy = rule.split(',')
  abort "Invalid route: #{rule}" unless providers.key?(tag) && (names.include?(policy) || policy == 'DIRECT')
end
config = {
  'mixed-port' => 7890, 'port' => 7222, 'socks-port' => 7221, 'allow-lan' => false,
  'bind-address' => '127.0.0.1', 'mode' => 'rule', 'log-level' => 'info', 'ipv6' => true,
  'profile' => { 'store-selected' => true },
  'dns' => { 'enable' => true, 'ipv6' => true, 'enhanced-mode' => 'fake-ip',
             'default-nameserver' => ['223.5.5.5', '1.1.1.1'],
             'nameserver' => ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'] },
  'sniffer' => { 'enable' => true, 'sniff' => { 'TLS' => { 'ports' => [443] }, 'HTTP' => { 'ports' => [80, '8080-8880'] } } },
  'proxy-groups' => groups, 'rule-providers' => providers,
  'rules' => local + finance_rules + app_rules + ['MATCH,兜底后备策略']
}
File.write(File.join(root, 'Clash/Loon_Configuration.yaml'),
           "# Generated from Loon/Loon_Configuration.lcf by scripts/build-loon-clash.rb\n# Requires Mihomo; see Clash/Loon_Configuration.md for adaptation details.\n" + YAML.dump(config))
puts "Generated Clash/Loon_Configuration.yaml: #{groups.size} groups, #{providers.size} providers"
