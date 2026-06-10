# PostgreSQL 远程连接诊断脚本 - Windows PowerShell
# 用法: .\test_pg_connection.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL 远程连接诊断工具" -ForegroundColor Cyan
Write-Host "服务器: 8.136.149.84:5432" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 步骤 1: 测试基本网络连接
Write-Host "[步骤 1] 测试 TCP 连接到 8.136.149.84:5432..." -ForegroundColor Yellow
try {
    $tcpTest = Test-NetConnection -ComputerName 8.136.149.84 -Port 5432 -WarningAction SilentlyContinue
    if ($tcpTest.TcpTestSucceeded) {
        Write-Host "✅ TCP 连接成功！端口 5432 已开放" -ForegroundColor Green
    } else {
        Write-Host "❌ TCP 连接失败！端口 5432 不可达" -ForegroundColor Red
        Write-Host ""
        Write-Host "可能原因:" -ForegroundColor Red
        Write-Host "  1. PostgreSQL 服务未启动" -ForegroundColor Yellow
        Write-Host "  2. 防火墙阻止了 5432 端口" -ForegroundColor Yellow
        Write-Host "  3. 云服务商安全组未放行" -ForegroundColor Yellow
        Write-Host "  4. PostgreSQL 未监听远程连接" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 网络连接测试出错: $_" -ForegroundColor Red
}

Write-Host ""

# 步骤 2: 使用 telnet 测试（如果可用）
Write-Host "[步骤 2] 使用 Telnet 测试连接..." -ForegroundColor Yellow
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $result = $tcpClient.BeginConnect("8.136.149.84", 5432, $null, $null)
    $wait = $result.AsyncWaitHandle.WaitOne(3000, $false)
    
    if ($wait) {
        $tcpClient.EndConnect($result)
        Write-Host "✅ Telnet 连接成功！PostgreSQL 正在监听" -ForegroundColor Green
        $tcpClient.Close()
    } else {
        Write-Host "❌ Telnet 超时 - 无法连接到 PostgreSQL" -ForegroundColor Red
        $tcpClient.Close()
    }
} catch {
    Write-Host "❌ Telnet 测试失败: $_" -ForegroundColor Red
}

Write-Host ""

# 步骤 3: 检查本地环境变量
Write-Host "[步骤 3] 检查数据库配置..." -ForegroundColor Yellow
$envPath = "$env:USERPROFILE\.env"
$projectEnvPath = "$PWD\.env"

if (Test-Path $projectEnvPath) {
    Write-Host "📄 项目 .env 文件: $projectEnvPath" -ForegroundColor Cyan
    $envContent = Get-Content $projectEnvPath -Raw
    if ($envContent -match 'DATABASE_URL=.+') {
        $dbUrl = $Matches[0].Replace('DATABASE_URL=', '').Trim()
        Write-Host "  DATABASE_URL: $dbUrl" -ForegroundColor Gray
        
        # 解析连接信息
        if ($dbUrl -match '@([^:]+):(\d+)/(\w+)') {
            Write-Host "  主机: $($Matches[1])" -ForegroundColor Gray
            Write-Host "  端口: $($Matches[2])" -ForegroundColor Gray
            Write-Host "  数据库: $($Matches[3])" -ForegroundColor Gray
        }
        
        # 检查是否使用远程数据库
        if ($dbUrl -like "*8.136.149.84*") {
            Write-Host "  ✅ 正在使用远程数据库" -ForegroundColor Green
        } elseif ($dbUrl -like "*localhost*" -or $dbUrl -like "*127.0.0.1*") {
            Write-Host "  ⚠️  正在使用本地数据库，需要修改为远程地址" -ForegroundColor Yellow
        }
    }
} elseif (Test-Path $envPath) {
    Write-Host "📄 用户 .env 文件: $envPath" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  未找到 .env 文件" -ForegroundColor Yellow
}

Write-Host ""

# 步骤 4: 检查 Python 依赖
Write-Host "[步骤 4] 检查 Python 依赖..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  🐍 $pythonVersion" -ForegroundColor Gray
    
    python -c "import psycopg2; print(f'✅ psycopg2 version: {psycopg2.__version__}')" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ psycopg2 已安装" -ForegroundColor Green
    } else {
        Write-Host "  ❌ psycopg2 未安装" -ForegroundColor Red
        Write-Host "  解决: python -m pip install psycopg2-binary" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ❌ Python 不可用" -ForegroundColor Red
}

Write-Host ""

# 步骤 5: 提供解决方案
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "修复建议" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if (!$tcpTest.TcpTestSucceeded) {
    Write-Host "🔧 需要在服务器上执行以下操作：" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. SSH 登录到服务器:" -ForegroundColor White
    Write-Host "     ssh root@8.136.149.84" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. 启动 PostgreSQL:" -ForegroundColor White
    Write-Host "     sudo systemctl start postgresql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. 编辑 /etc/postgresql/*/main/postgresql.conf:" -ForegroundColor White
    Write-Host "     listen_addresses = '*'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  4. 编辑 pg_hba.conf 添加:" -ForegroundColor White
    Write-Host "     host    all    all    0.0.0.0/0    scram-sha-256" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  5. 开放防火墙:" -ForegroundColor White
    Write-Host "     sudo firewall-cmd --permanent --add-port=5432/tcp" -ForegroundColor Gray
    Write-Host "     sudo firewall-cmd --reload" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  6. 重启 PostgreSQL:" -ForegroundColor White
    Write-Host "     sudo systemctl restart postgresql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  7. 或者自动修复脚本:" -ForegroundColor White
    Write-Host "     bash /tmp/fix_pg_connection.sh" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "✅ 网络连接正常！" -ForegroundColor Green
    Write-Host ""
    Write-Host "如果仍然无法连接，请检查:" -ForegroundColor Yellow
    Write-Host "  1. PostgreSQL 用户和密码是否正确" -ForegroundColor White
    Write-Host "  2. 数据库是否存在" -ForegroundColor White
    Write-Host "  3. PostgreSQL 认证配置" -ForegroundColor White
    Write-Host ""
    Write-Host "测试 Python 连接:" -ForegroundColor Yellow
    Write-Host "  cd backend && python db_helper.py status" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "完整指南请查看: scripts\FIX_PG_CONNECTION.md" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
