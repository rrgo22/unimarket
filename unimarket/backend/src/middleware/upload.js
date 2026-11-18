const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const BASE = path.join(__dirname, '..', '..', 'uploads');
const DIR_DOCS = path.join(BASE, 'documentos');
const DIR_PROD = path.join(BASE, 'productos');
const DIR_EMP = path.join(BASE, 'empresas');
const DIR_COMP = path.join(BASE, 'comprobantes');
[DIR_DOCS, DIR_PROD, DIR_EMP, DIR_COMP].forEach((d) => fs.mkdirSync(d, { recursive: true }));

const nombreAleatorio = (ext) => `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

const storage = (dir) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, nombreAleatorio(ext));
    },
  });

// Capa 2: solo PDF (NIT) o imagen (productos / perfil empresa), con tamaño máximo
const soloPdf = (_req, file, cb) => {
  if (file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname)) return cb(null, true);
  cb(new Error('FORMATO_PDF'));
};

const soloImagen = (_req, file, cb) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
  cb(new Error('FORMATO_IMAGEN'));
};

const soloComprobante = (_req, file, cb) => {
  const esPdf = file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname);
  const esImg = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
  if (esPdf || esImg) return cb(null, true);
  cb(new Error('FORMATO_COMPROBANTE'));
};

const subirDocumento = multer({
  storage: storage(DIR_DOCS),
  fileFilter: soloPdf,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const subirComprobante = multer({
  storage: storage(DIR_COMP),
  fileFilter: soloComprobante,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

const subirImagenes = multer({
  storage: storage(DIR_PROD),
  fileFilter: soloImagen,
  limits: { fileSize: 3 * 1024 * 1024, files: 4 },
});

const subirPerfilEmpresa = multer({
  storage: storage(DIR_EMP),
  fileFilter: soloImagen,
  limits: { fileSize: 3 * 1024 * 1024 },
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'portada', maxCount: 1 },
]);

// Convierte errores de multer en respuestas legibles
function erroresUpload(err, _req, res, next) {
  if (!err) return next();
  if (err.message === 'FORMATO_PDF') return res.status(400).json({ error: 'El documento debe estar en formato PDF', campo: 'documento' });
  if (err.message === 'FORMATO_IMAGEN') return res.status(400).json({ error: 'Las imágenes deben ser JPG, PNG o WEBP' });
  if (err.message === 'FORMATO_COMPROBANTE') return res.status(400).json({ error: 'El comprobante debe ser un archivo PDF, JPG, PNG o WEBP', campo: 'comprobante' });
  if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Archivo demasiado grande o formato inválido' });
  next(err);
}

module.exports = {
  subirDocumento,
  subirComprobante,
  subirImagenes,
  subirPerfilEmpresa,
  erroresUpload,
  DIR_DOCS,
  DIR_PROD,
  DIR_EMP,
  DIR_COMP,
  BASE,
};

