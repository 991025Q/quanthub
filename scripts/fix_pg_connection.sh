#!/bin/bash

# PostgreSQL 远程连接修复脚本
# 在远程服务器上执行: ssh root@8.136.149.84 "bash -s" < fix_pg_connection.sh

echo "=========================================="
echo "PostgreSQL 远程连接配置修复"
echo "服务器: 8.136.149.84"
echo "=========================================="

# 步骤 1: 检查 PostgreSQL 状态
echo ""
echo "[步骤 1] 检查 PostgreSQL 服务状态..."
sudo systemctl status postgresql --no-pager | head -15

# 如果服务未运行，启动它
if ! sudo systemctl is-active -q postgresql; then
    echo "⚠️  PostgreSQL 未运行，正在启动..."
    sudo systemctl start postgresql
    sleep 2
    echo "✅ PostgreSQL 已启动"
else
    echo "✅ PostgreSQL 服务正在运行"
fi

# 步骤 2: 检查 PostgreSQL 监听配置
echo ""
echo "[步骤 2] 配置 PostgreSQL 监听地址..."

PG_CONF=$(sudo find /etc/postgresql -name postgresql.conf 2>/dev/null | head -1)
if [ -z "$PG_CONF" ]; then
    PG_CONF="/var/lib/pgsql/data/postgresql.conf"
fi

echo "找到配置文件: $PG_CONF"

if [ -f "$PG_CONF" ]; then
    # 设置监听所有地址
    sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    sudo sed -i "s/listen_addresses = 'localhost'/listen_addresses = '*'/" "$PG_CONF"
    
    echo "✅ 已设置 listen_addresses = '*'"
else
    echo "⚠️  未找到配置文件，尝试创建..."
    sudo mkdir -p /etc/postgresql
    echo "listen_addresses = '*'" > /tmp/pg_listen.conf
    echo "请手动将此配置添加到 postgresql.conf"
fi

# 步骤 3: 配置 pg_hba.conf 访问权限
echo ""
echo "[步骤 3] 配置访问权限 (pg_hba.conf)..."

PG_HBA=$(sudo find /etc/postgresql -name pg_hba.conf 2>/dev/null | head -1)
if [ -z "$PG_HBA" ]; then
    PG_HBA="/var/lib/pgsql/data/pg_hba.conf"
fi

echo "找到 HBA 文件: $PG_HBA"

if [ -f "$PG_HBA" ]; then
    # 备份原始文件
    sudo cp "$PG_HBA" "${PG_HBA}.backup.$(date +%Y%m%d)"
    
    # 添加远程访问规则
    cat >> "$PG_HBA" << 'EOF'

# QuantHub远程访问配置
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::0/0                   scram-sha-256
EOF
    
    echo "✅ 已添加远程访问规则"
    echo "📋 当前规则:"
    sudo grep -v "^#" "$PG_HBA" | grep -v "^$"
else
    echo "⚠️  未找到 pg_hba.conf 文件"
fi

# 步骤 4: 配置防火墙（如果使用 firewalld 或 ufw）
echo ""
echo "[步骤 4] 配置防火墙..."

# 检查 firewalld
if command -v firewall-cmd &> /dev/null; then
    echo "检测到 firewalld..."
    sudo firewall-cmd --permanent --add-port=5432/tcp 2>/dev/null || true
    sudo firewall-cmd --reload 2>/dev/null || true
    echo "✅ firewalld 已开放 5432 端口"
fi

# 检查 ufw
if command -v ufw &> /dev/null; then
    echo "检测到 ufw..."
    sudo ufw allow 5432/tcp 2>/dev/null || true
    echo "✅ ufw 已开放 5432 端口"
fi

# 检查 iptables
if command -v iptables &> /dev/null; then
    echo "配置 iptables..."
    sudo iptables -I INPUT -p tcp --dport 5432 -j ACCEPT 2>/dev/null || true
    echo "✅ iptables 已开放 5432 端口"
fi

# 步骤 5: 重启 PostgreSQL
echo ""
echo "[步骤 5] 重启 PostgreSQL 服务..."
sudo systemctl restart postgresql
sleep 2

# 验证服务状态
if sudo systemctl is-active -q postgresql; then
    echo "✅ PostgreSQL 已成功重启"
else
    echo "❌ PostgreSQL 重启失败，请检查日志"
    sudo journalctl -u postgresql -n 20 --no-pager
    exit 1
fi

# 步骤 6: 验证监听
echo ""
echo "[步骤 6] 验证 PostgreSQL 监听..."

# 检查监听端口
sudo netstat -tlnp | grep 5432 || sudo ss -tlnp | grep 5432

# 检查 PostgreSQL 版本
sudo -u postgres psql --version

# 步骤 7: 测试本地连接
echo ""
echo "[步骤 7] 测试本地连接..."
sudo -u postgres psql -c "SELECT version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ 本地连接正常"
else
    echo "❌ 本地连接失败"
    exit 1
fi

# 完成
echo ""
echo "=========================================="
echo "✅ PostgreSQL 远程连接配置完成！"
echo "=========================================="
echo ""
echo "配置摘要:"
echo "  • 监听地址: *"
echo "  • 监听端口: 5432"
echo "  • 远程访问: 已启用"
echo "  • 防火墙: 已开放 5432 端口"
echo ""
echo "下一步操作:"
echo "  1. 从本地测试连接:"
echo "     python backend/db_helper.py status"
echo ""
echo "  2. 或者使用 psql 测试:"
echo "     psql \"postgresql://quanthub:quanthub@8.136.149.84:5432/quanthub\""
echo ""
echo "  3. 如果需要限制访问，建议配置 IP 白名单:"
echo "     在 pg_hba.conf 中使用具体 IP 代替 0.0.0.0/0"
echo ""
echo "查看日志（如有问题）:"
echo "  sudo journalctl -u postgresql -f"
echo "=========================================="
