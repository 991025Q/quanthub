# PostgreSQL 远程连接问题修复指南

## 🔍 问题状态

**错误信息**: `Connection refused (10061)` - 无法连接到 8.136.149.84:5432

**可能原因**:
1. ✅ PostgreSQL 服务未启动
2. ✅ PostgreSQL 未配置监听远程连接
3. ✅ 防火墙阻止 5432 端口
4. ✅ pg_hba.conf 未允许远程访问

---

## 🛠️ 解决方案

### 方案 1: 自动修复脚本（推荐）

已在服务器上传脚本 `/tmp/fix_pg_connection.sh`

**执行方式**:
```bash
ssh root@8.136.149.84 "bash /tmp/fix_pg_connection.sh"
```

---

### 方案 2: 手动修复步骤

#### 步骤 1: SSH 登录到服务器

```bash
ssh root@8.136.149.84
```

#### 步骤 2: 检查 PostgreSQL 状态

```bash
# 查看服务状态
systemctl status postgresql

# 如果未运行，启动它
systemctl start postgresql

# 设置开机自启
systemctl enable postgresql
```

#### 步骤 3: 配置监听地址

查找配置文件位置：
```bash
find /etc/postgresql -name postgresql.conf 2>/dev/null
# 或者
find /var/lib/pgsql -name postgresql.conf 2>/dev/null
```

编辑配置文件（根据上一步找到的路径）：
```bash
sudo vi /etc/postgresql/13/main/postgresql.conf
# 或
sudo vi /var/lib/pgsql/data/postgresql.conf
```

找到或添加这行：
```conf
listen_addresses = '*'
```

保存并退出。

#### 步骤 4: 配置远程访问权限

查找 HBA 配置文件：
```bash
find /etc/postgresql -name pg_hba.conf 2>/dev/null
# 或
find /var/lib/pgsql -name pg_hba.conf 2>/dev/null
```

编辑配置文件：
```bash
sudo vi /etc/postgresql/13/main/pg_hba.conf
```

在文件末尾添加：
```conf
# QuantHub 远程访问
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::0/0                   scram-sha-256
```

保存并退出。

#### 步骤 5: 配置防火墙

如果使用 **firewalld**:
```bash
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload
```

如果使用 **ufw**:
```bash
sudo ufw allow 5432/tcp
```

如果使用 **iptables**:
```bash
sudo iptables -I INPUT -p tcp --dport 5432 -j ACCEPT
sudo service iptables save
```

#### 步骤 6: 重启 PostgreSQL

```bash
sudo systemctl restart postgresql
sleep 2
systemctl status postgresql
```

#### 步骤 7: 验证监听

```bash
# 检查是否监听 5432 端口
netstat -tlnp | grep 5432
# 或
ss -tlnp | grep 5432
```

应该看到类似输出：
```
tcp  0  0 0.0.0.0:5432  0.0.0.0:*  LISTEN  xxx/postgres
```

#### 步骤 8: 测试本地连接

```bash
sudo -u postgres psql -c "SELECT version();"
```

#### 步骤 9: 从本地测试连接

在**你的本地电脑**上执行：

```powershell
# 使用 psql 测试
psql "postgresql://quanthub:quanthub@8.136.149.84:5432/quanthub"

# 或使用 Python 测试
python backend/db_helper.py status
```

---

## 🔧 常见问题排查

### 问题 1: 找不到 postgresql.conf

**原因**: PostgreSQL 安装位置不同

**解决**:
```bash
# 查找所有可能的配置文件
sudo find / -name postgresql.conf 2>/dev/null | grep -v proc

# 常见位置：
# /etc/postgresql/13/main/postgresql.conf
# /var/lib/pgsql/data/postgresql.conf
# /usr/local/pgsql/data/postgresql.conf
```

### 问题 2: firewalld/ufw 未安装

**检查**:
```bash
# 检查防火墙状态
firewall-cmd --state  # firewalld
ufw status            # ufw
iptables -L           # iptables
```

### 问题 3: 云服务商安全组

如果是阿里云/腾讯云等，还需要在控制台配置安全组：

1. 登录云控制台
2. 找到 ECS/云服务器
3. 安全组规则 → 添加入站规则
4. 配置：
   - 端口范围：5432/5432
   - 源：0.0.0.0/0（或你的 IP）
   - 协议：TCP

### 问题 4: SELinux 阻止

**检查**:
```bash
getenforce
```

**临时关闭**:
```bash
sudo setenforce 0
```

**永久关闭**（编辑 /etc/selinux/config）:
```
SELINUX=permissive
```

---

## ✅ 验证清单

完成以下步骤后确认：

- [ ] PostgreSQL 服务正在运行 (`systemctl status postgresql`)
- [ ] 监听所有地址 (`netstat -tlnp | grep 5432` 显示 0.0.0.0:5432)
- [ ] 防火墙已开放 5432 端口
- [ ] pg_hba.conf 允许远程访问
- [ ] 本地可以连接 (`psql "postgresql://quanthub:quanthub@8.136.149.84:5432/quanthub"`)

---

## 📊 快速诊断命令

复制以下命令一次性收集所有诊断信息：

```bash
ssh root@8.136.149.84 << 'EOF'
echo "=== PostgreSQL Status ==="
systemctl status postgresql --no-pager | head -10

echo ""
echo "=== Listening Ports ==="
netstat -tlnp | grep 5432 || ss -tlnp | grep 5432

echo ""
echo "=== PG Config Listen Address ==="
grep listen_addresses /etc/postgresql/*/main/postgresql.conf 2>/dev/null || \
grep listen_addresses /var/lib/pgsql/data/postgresql.conf 2>/dev/null

echo ""
echo "=== PG HBA Rules ==="
grep -v "^#" /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | grep -v "^$" || \
grep -v "^#" /var/lib/pgsql/data/pg_hba.conf 2>/dev/null | grep -v "^$"

echo ""
echo "=== Firewall Status ==="
firewall-cmd --list-ports 2>/dev/null || ufw status 2>/dev/null || iptables -L -n | grep 5432
EOF
```

---

## 🆘 仍然无法连接？

如果以上步骤都无法解决问题，请提供以下信息：

1. **服务器日志**:
   ```bash
   sudo journalctl -u postgresql -n 50 --no-pager
   ```

2. **PostgreSQL 版本**:
   ```bash
   psql --version
   rpm -qa | grep postgres  # CentOS/RHEL
   dpkg -l | grep postgres  # Ubuntu/Debian
   ```

3. **网络诊断**:
   ```powershell
   # 在你的本地电脑上
   telnet 8.136.149.84 5432
   # 或
   Test-NetConnection -ComputerName 8.136.149.84 -Port 5432
   ```
