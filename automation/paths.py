"""Pasta de dados da automação (banco SQLite, cota do YouTube, tokens OAuth).

Padrão: <raiz do projeto>/data. Os testes apontam a variável de ambiente LECCORTUBE_DATA_DIR para
uma pasta temporária **antes** de importar os módulos da automação, para nunca gravar no banco real
(antes, cada execução de test_fase1/test_pipeline criava lotes de teste em data/automation.db).
"""
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


PREFIXO_TESTE = "leccortube_teste_"


def pasta_dados() -> str:
    return os.environ.get("LECCORTUBE_DATA_DIR") or os.path.join(RAIZ, "data")


def isolar_para_teste() -> str:
    """Cria uma pasta de dados temporária e aponta LECCORTUBE_DATA_DIR para ela.

    Chamar no topo dos testes, antes de importar qualquer outro módulo da automação. Apaga as pastas de
    execuções anteriores (no Windows o SQLite ainda está aberto quando o teste termina, então a pasta da
    execução atual só some na próxima).
    """
    import glob
    import shutil
    import tempfile

    for antiga in glob.glob(os.path.join(tempfile.gettempdir(), PREFIXO_TESTE + "*")):
        shutil.rmtree(antiga, ignore_errors=True)
    pasta = tempfile.mkdtemp(prefix=PREFIXO_TESTE)
    os.environ["LECCORTUBE_DATA_DIR"] = pasta
    return pasta
