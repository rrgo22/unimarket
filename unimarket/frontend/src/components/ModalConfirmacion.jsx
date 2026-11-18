import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';
import Modal from './Modal.jsx';

export default function ModalConfirmacion({
  abierto,
  titulo = 'Confirmar acción',
  mensaje,
  tipo = 'peligro', // 'peligro' | 'info' | 'prompt'
  textoBotonConfirmar = 'Confirmar',
  textoBotonCancelar = 'Cancelar',
  requiereTexto = false,
  placeholderTexto = '',
  valorInicialTexto = '',
  tipoEntrada = 'text', // 'text' | 'textarea' | 'date'
  onConfirmar,
  onCancelar,
}) {
  const [texto, setTexto] = useState(valorInicialTexto);
  const [errorLocal, setErrorLocal] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (abierto) {
      setTexto(valorInicialTexto);
      setErrorLocal('');
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [abierto, valorInicialTexto]);

  if (!abierto) return null;

  const handleConfirmar = (e) => {
    e.preventDefault();
    if (requiereTexto && (!texto || texto.trim().length < 5)) {
      setErrorLocal('Debe ingresar al menos 5 caracteres.');
      return;
    }
    onConfirmar(requiereTexto ? texto.trim() : true);
  };

  const esPeligro = tipo === 'peligro';

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCancelar}
      maxWidth="max-w-md"
      ariaLabelledBy="modal-confirm-title"
      mostrarBotonCerrar={false}
      manijaMovil={true}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
            esPeligro
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
              : 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
          }`}
        >
          {esPeligro ? (
            <AlertTriangle size={20} strokeWidth={2} aria-hidden="true" />
          ) : (
            <HelpCircle size={20} strokeWidth={2} aria-hidden="true" />
          )}
        </div>

        <div className="grow min-w-0">
          <div className="flex items-center justify-between">
            <h3 id="modal-confirm-title" className="text-base font-bold text-white truncate">
              {titulo}
            </h3>
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Cerrar modal"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {mensaje && <p className="mt-1 text-sm text-slate-300 leading-relaxed">{mensaje}</p>}
        </div>
      </div>

      <form onSubmit={handleConfirmar} className="mt-4 space-y-4">
        {requiereTexto && (
          <div>
            {tipoEntrada === 'textarea' ? (
              <textarea
                ref={inputRef}
                rows={3}
                className="input text-sm w-full"
                placeholder={placeholderTexto}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  if (errorLocal) setErrorLocal('');
                }}
              />
            ) : (
              <input
                ref={inputRef}
                type={tipoEntrada}
                className="input text-sm w-full"
                placeholder={placeholderTexto}
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                  if (errorLocal) setErrorLocal('');
                }}
              />
            )}
            {errorLocal && <p className="err text-rose-300">{errorLocal}</p>}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-white/10">
          <button type="button" onClick={onCancelar} className="btn-light w-full sm:w-auto">
            {textoBotonCancelar}
          </button>
          <button
            type="submit"
            className={`w-full sm:w-auto ${esPeligro ? 'btn-danger' : 'btn-cta'}`}
          >
            {textoBotonConfirmar}
          </button>
        </div>
      </form>
    </Modal>
  );
}
