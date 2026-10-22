
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

const DB_FILE = path.join(__dirname, "db.json");
const FRONTEND_DIR = __dirname;

app.use(express.json());
app.use(cors());
app.use(express.static(FRONTEND_DIR));

// ABRIR A PÁGINA INICIAL
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// BANCO DE DADOS
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const db = {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: [],
      tv_chamada: null,
      tv_historico: []
    };

    writeDB(db);
    return db;
  }

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

  if (!Array.isArray(db.usuarios)) db.usuarios = [];
  if (!Array.isArray(db.pacientes)) db.pacientes = [];
  if (!Array.isArray(db.triagens)) db.triagens = [];
  if (!Array.isArray(db.consultas)) db.consultas = [];
  if (db.tv_chamada === undefined) db.tv_chamada = null;
  if (!Array.isArray(db.tv_historico)) db.tv_historico = [];

  return db;
}

function writeDB(db) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}

function tratarErro(res, erro, mensagem) {
  console.error(mensagem, erro);

  if (!res.headersSent) {
    res.status(500).json({
      erro: mensagem
    });
  }
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    usuario: usuario.usuario,
    tipo: usuario.tipo
  };
}

// TESTAR API
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mensagem: "API funcionando"
  });
});

// LOGIN
app.post("/login", (req, res) => {
  try {
    const { usuario, senha } = req.body || {};

    if (
      typeof usuario !== "string" ||
      typeof senha !== "string" ||
      !usuario.trim() ||
      !senha
    ) {
      return res.status(400).json({
        erro: "Informe usuário e senha."
      });
    }

    const db = readDB();

    const nome = usuario.trim().toLowerCase();

    const encontrado = db.usuarios.find(u =>
      typeof u.usuario === "string" &&
      u.usuario.trim().toLowerCase() === nome &&
      u.senha === senha
    );

    if (!encontrado) {
      return res.status(401).json({
        erro: "Usuário ou senha incorretos."
      });
    }

    res.json(usuarioPublico(encontrado));

  } catch (erro) {
    tratarErro(res, erro, "Erro ao realizar login.");
  }
});

// LISTAR USUÁRIOS
app.get("/usuarios", (req, res) => {
  try {
    const db = readDB();

    res.json(
      db.usuarios.map(usuarioPublico)
    );

  } catch (erro) {
    tratarErro(res, erro, "Erro ao listar usuários.");
  }
});

// CADASTRAR USUÁRIO
app.post("/usuarios", (req, res) => {
  try {
    const { usuario, senha, tipo } = req.body || {};

    if (
      typeof usuario !== "string" ||
      typeof senha !== "string" ||
      typeof tipo !== "string" ||
      !usuario.trim() ||
      !senha ||
      !tipo
    ) {
      return res.status(400).json({
        erro: "Preencha todos os campos."
      });
    }

    const tiposPermitidos = [
      "atendimento",
      "triagem",
      "medico"
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        erro: "Tipo de usuário inválido."
      });
    }

    const db = readDB();
    const nome = usuario.trim().toLowerCase();

    const existe = db.usuarios.some(u =>
      typeof u.usuario === "string" &&
      u.usuario.trim().toLowerCase() === nome
    );

    if (existe) {
      return res.status(409).json({
        erro: "Este usuário já está cadastrado."
      });
    }

    const novoUsuario = {
      id: Date.now(),
      usuario: usuario.trim(),
      senha,
      tipo
    };

    db.usuarios.push(novoUsuario);
    writeDB(db);

    res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso.",
      usuario: usuarioPublico(novoUsuario)
    });

  } catch (erro) {
    tratarErro(res, erro, "Erro ao cadastrar usuário.");
  }
});

// CADASTRAR PACIENTE - ATENDIMENTO
app.post("/atendimento", (req, res) => {
  try {
    const { nome, cpf, tipo } = req.body || {};

    if (typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        erro: "Informe o nome do paciente."
      });
    }

    const db = readDB();

    const paciente = {
      id: Date.now(),
      nome: nome.trim(),
      cpf: cpf || "",
      tipo: tipo || "",
      status: "triagem",
      createdAt: new Date().toISOString()
    };

    db.pacientes.push(paciente);
    writeDB(db);

    res.status(201).json(paciente);

  } catch (erro) {
    tratarErro(res, erro, "Erro ao cadastrar paciente.");
  }
});

// LISTAR PACIENTES
app.get("/pacientes", (req, res) => {
  try {
    res.json(readDB().pacientes);
  } catch (erro) {
    tratarErro(res, erro, "Erro ao listar pacientes.");
  }
});

// CADASTRAR TRIAGEM
app.post("/triagem", (req, res) => {
  try {
    const {
      nome,
      sintoma,
      temperatura,
      alergia,
      observacao
    } = req.body || {};

    let risco = req.body?.risco;

    if (typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({
        erro: "Informe o nome do paciente."
      });
    }

    const temp = temperatura === "" || temperatura == null
      ? null
      : Number(temperatura);

    if (temp !== null && !Number.isFinite(temp)) {
      return res.status(400).json({
        erro: "Temperatura inválida."
      });
    }

    if (temp !== null && temp >= 39) {
      risco = "vermelho";
    } else if (temp !== null && temp >= 38) {
      risco = "amarelo";
    } else if (!risco) {
      risco = "verde";
    }

    const db = readDB();

    const triagem = {
      id: Date.now(),
      nome: nome.trim(),
      sintoma: sintoma || "",
      temperatura: temp,
      alergia: alergia || "",
      observacao: observacao || "",
      risco,
      status: "aguardando_medico",
      createdAt: new Date().toISOString()
    };

    db.triagens.push(triagem);
    writeDB(db);

    res.status(201).json(triagem);

  } catch (erro) {
    tratarErro(res, erro, "Erro ao cadastrar triagem.");
  }
});

// LISTAR TRIAGENS
app.get("/triagens", (req, res) => {
  try {
    res.json(readDB().triagens);
  } catch (erro) {
    tratarErro(res, erro, "Erro ao listar triagens.");
  }
});

// CHAMAR PACIENTE NA TV
app.post("/tv/chamar", (req, res) => {
  try {
    const {
      localTipo,
      localNumero,
      paciente
    } = req.body || {};

    if (!paciente) {
      return res.status(400).json({
        erro: "Informe o paciente."
      });
    }

    const db = readDB();

    const chamada = {
      id: Date.now().toString(),
      localTipo: localTipo || "",
      localNumero: localNumero || "",
      paciente,
      hora: new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };

    db.tv_chamada = chamada;
    db.tv_historico.unshift(chamada);
    db.tv_historico = db.tv_historico.slice(0, 5);

    writeDB(db);

    res.status(201).json(chamada);

  } catch (erro) {
    tratarErro(res, erro, "Erro ao chamar paciente.");
  }
});

// CONSULTAR CHAMADA DA TV
app.get("/tv/chamada", (req, res) => {
  try {
    const db = readDB();

    res.json({
      chamada: db.tv_chamada,
      historico: db.tv_historico
    });

  } catch (erro) {
    tratarErro(res, erro, "Erro ao consultar chamadas.");
  }
});

// LISTA DE MEDICAÇÕES
app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});

// REGISTRAR CONSULTA
app.post("/consulta", (req, res) => {
  try {
    const {
      paciente,
      diagnostico,
      medicacao,
      obs
    } = req.body || {};

    if (!paciente) {
      return res.status(400).json({
        erro: "Informe o paciente."
      });
    }

    const db = readDB();

    const consulta = {
      id: Date.now(),
      paciente,
      diagnostico: diagnostico || "",
      medicacao: medicacao || "",
      obs: obs || "",
      createdAt: new Date().toISOString()
    };

    db.consultas.push(consulta);
    writeDB(db);

    res.status(201).json(consulta);

  } catch (erro) {
    tratarErro(res, erro, "Erro ao registrar consulta.");
  }
});

// LISTAR CONSULTAS
app.get("/medicacoes", (req, res) => {
  try {
    res.json(readDB().consultas);
  } catch (erro) {
    tratarErro(res, erro, "Erro ao listar consultas.");
  }
});

// TRATAR JSON INVÁLIDO
app.use((erro, req, res, next) => {
  if (erro instanceof SyntaxError && "body" in erro) {
    return res.status(400).json({
      erro: "O JSON enviado é inválido."
    });
  }

  console.error("Erro não tratado:", erro);

  res.status(500).json({
    erro: "Erro interno do servidor."
  });
});

// ROTA NÃO ENCONTRADA
app.use((req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada.",
    metodo: req.method,
    caminho: req.path
  });
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(`Hospital Pro rodando em http://localhost:${PORT}`);
  console.log(`Frontend: ${FRONTEND_DIR}`);
  console.log(`Banco: ${DB_FILE}`);
});
