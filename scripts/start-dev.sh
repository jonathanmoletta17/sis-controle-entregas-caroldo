#!/bin/bash
# Script de inicialização segura - verifica portas antes de iniciar

echo "🔍 Verificando portas em uso..."

# Portas em uso por Docker (PRODUÇÃO)
echo "📦 Dashboards em Docker:"
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -E "(3000|3001|3002|3003)" || echo "   Nenhum dashboard encontrado nas portas padrão"

# Portas locais
echo "💻 Portas locais:"
PORTAS=("3000" "3001" "3002" "3003" "3004" "3005" "3006" "3007" "3008" "3009")
for porta in "${PORTAS[@]}"; do
    if ss -tlnp | grep -q ":$porta"; then
        echo "   ⚠️  Porta $porta: OCUPADA"
        if lsof -ti:$porta 2>/dev/null | xargs ps -p {} -o cmd= 2>/dev/null | grep -q "docker"; then
            echo "      → Docker (PRODUÇÃO - NÃO TOCAR)"
        else
            echo "      → Processo local"
        fi
    else
        echo "   ✅ Porta $porta: LIVRE"
    fi
done

# Recomendação
echo ""
echo "🎯 Recomendação para desenvolvimento:"
echo "   Use porta 3006 (livre para desenvolvimento local)"
echo ""

# Iniciar
export PORT=3006
echo "🚀 Iniciando desenvolvimento na porta $PORT"
export PORT=$PORT bun run dev