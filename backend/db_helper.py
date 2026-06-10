#!/usr/bin/env python3
"""
Database Migration Helper Script
Quick operations for database management
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.config import get_settings


async def check_connection():
    """Test database connection"""
    settings = get_settings()
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ Connected to PostgreSQL:")
            print(f"   Version: {version}")
            print(f"   Database: {settings.DATABASE_URL.split('/')[-1]}")
        await engine.dispose()
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


async def list_tables():
    """List all user tables"""
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """))
        tables = [row[0] for row in result.fetchall()]
        
        print(f"\n📊 Tables in database ({len(tables)} total):\n")
        for table in tables:
            # Get row count
            count_result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = count_result.scalar()
            print(f"   • {table:<30s} ({count:>6} rows)")
        
    await engine.dispose()


async def show_table_structure(table_name: str):
    """Show table structure"""
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.connect() as conn:
        # Get column info
        result = await conn.execute(text("""
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = :table
            ORDER BY ordinal_position
        """), {"table": table_name})
        
        columns = result.fetchall()
        
        if not columns:
            print(f"❌ Table '{table_name}' not found")
            await engine.dispose()
            return
        
        print(f"\n📋 Structure for table '{table_name}':\n")
        print(f"{'Column':<30} {'Type':<25} {'Nullable':<10} {'Default'}")
        print("-" * 100)
        
        for col in columns:
            name, dtype, length, nullable, default = col
            type_str = f"{dtype}"
            if length:
                type_str += f"({length})"
            nullable_str = "YES" if nullable == "YES" else "NO"
            print(f"{name:<30} {type_str:<25} {nullable_str:<10} {default or ''}")
        
        # Show indexes
        result = await conn.execute(text("""
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = :table
        """), {"table": table_name})
        
        indexes = result.fetchall()
        if indexes:
            print(f"\n🔍 Indexes:")
            for idx in indexes:
                print(f"   • {idx[0]}")
                print(f"     {idx[1]}")
    
    await engine.dispose()


async def backup_database(output_file: str = None):
    """Simple backup using SQLAlchemy export"""
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    
    if output_file is None:
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"backup_{timestamp}.sql"
    
    print(f"\n💾 Backup will be saved to: {output_file}")
    print(f"⚠️  Note: For full backups, use pg_dump:")
    print(f"   pg_dump -h host -U user dbname > {output_file}")
    print(f"\nFor SQLAlchemy model export, use:")
    print(f"   python -m alembic history")
    
    await engine.dispose()


async def main():
    """Main command dispatcher"""
    if len(sys.argv) < 2:
        print("🗄️  Database Migration Helper")
        print("=" * 40)
        print("\nUsage: python db_helper.py <command> [args]\n")
        print("Commands:")
        print("  status                    Check database connection and status")
        print("  list                      List all tables")
        print("  schema <table_name>       Show table structure")
        print("  backup                    Show backup instructions")
        print("\nExamples:")
        print("  python db_helper.py status")
        print("  python db_helper.py list")
        print("  python db_helper.py schema users")
        return
    
    command = sys.argv[1].lower()
    
    if command == "status":
        print("🔍 Checking database connection...\n")
        success = await check_connection()
        if success:
            await list_tables()
    
    elif command == "list":
        await list_tables()
    
    elif command == "schema":
        if len(sys.argv) < 3:
            print("❌ Please provide table name")
            print("Usage: python db_helper.py schema <table_name>")
            return
        await show_table_structure(sys.argv[2])
    
    elif command == "backup":
        output_file = sys.argv[2] if len(sys.argv) > 2 else None
        await backup_database(output_file)
    
    else:
        print(f"❌ Unknown command: {command}")
        print("Run without arguments to see usage\n")


if __name__ == "__main__":
    asyncio.run(main())
