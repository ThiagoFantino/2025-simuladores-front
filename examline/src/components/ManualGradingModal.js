import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../modern-examline.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

export default function ManualGradingModal({ attemptId, onClose, onSave }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [attempt, setAttempt] = useState(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [fileVersion, setFileVersion] = useState('submission');
  const [editedCode, setEditedCode] = useState('');
  const [executionResult, setExecutionResult] = useState(null);
  const [calificacionManual, setCalificacionManual] = useState('');
  const [saving, setSaving] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [useCustomInput, setUseCustomInput] = useState(false);

  useEffect(() => {
    loadAttemptDetails();
  }, [attemptId]);

  const loadAttemptDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/exam-attempts/${attemptId}/professor-view`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAttempt(data);
        
        // 🔒 IMPORTANTE: Cargar por defecto el archivo main en versión manual
        // Este es el archivo que se usó para la corrección automática
        const mainFileName = data.exam.lenguajeProgramacion === 'python' ? 'main.py' : 'main.js';
        
        // Intentar encontrar el archivo main en versión manual
        let targetVersion = 'manual';
        let targetIndex = data.manualFiles.findIndex(f => f.filename === mainFileName);
        
        // Si no existe en manual, buscar en submission
        if (targetIndex === -1 && data.submissionFiles.length > 0) {
          targetVersion = 'submission';
          targetIndex = data.submissionFiles.findIndex(f => f.filename === mainFileName);
        }
        
        // Si aún no se encuentra, usar el primer archivo disponible
        if (targetIndex === -1) {
          targetVersion = data.manualFiles.length > 0 ? 'manual' : 'submission';
          targetIndex = 0;
        }
        
        // Configurar el estado inicial
        setFileVersion(targetVersion);
        setSelectedFileIndex(targetIndex);
        
        const files = targetVersion === 'manual' ? data.manualFiles : data.submissionFiles;
        if (files && files.length > 0 && files[targetIndex]) {
          setEditedCode(files[targetIndex].content || '');
        }

        // Pre-llenar calificación manual si ya existe
        if (data.calificacionManual !== null) {
          setCalificacionManual(data.calificacionManual.toString());
        }
      }
    } catch (error) {
      console.error('Error loading attempt:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentFiles = () => {
    if (!attempt) return [];
    return fileVersion === 'submission' ? attempt.submissionFiles : attempt.manualFiles;
  };

  const handleFileChange = (index) => {
    setSelectedFileIndex(index);
    const files = getCurrentFiles();
    if (files[index]) {
      setEditedCode(files[index].content || '');
    }
    setExecutionResult(null);
  };

  const handleVersionChange = (newVersion) => {
    setFileVersion(newVersion);
    const newFiles = newVersion === 'submission' ? attempt.submissionFiles : attempt.manualFiles;
    
    // Intentar mantener el mismo archivo o seleccionar el primero
    const currentFileName = getCurrentFiles()[selectedFileIndex]?.filename;
    const sameFileIndex = newFiles.findIndex(f => f.filename === currentFileName);
    const newIndex = sameFileIndex !== -1 ? sameFileIndex : 0;
    
    setSelectedFileIndex(newIndex);
    if (newFiles[newIndex]) {
      setEditedCode(newFiles[newIndex].content || '');
    }
    setExecutionResult(null);
  };

  const handleExecute = async () => {
    if (!attempt || attempt.exam.tipo !== 'programming') return;

    try {
      setExecuting(true);
      setExecutionResult(null);

      const currentFiles = getCurrentFiles();
      const mainFile = currentFiles[selectedFileIndex];

      if (!mainFile) {
        setExecutionResult({
          error: 'No hay archivo seleccionado para ejecutar'
        });
        return;
      }

      // Preparar payload para ejecución
      const payload = {
        code: editedCode,
        language: attempt.exam.lenguajeProgramacion,
        filename: mainFile.filename,
        // Si usa input personalizado, enviarlo
        ...(useCustomInput && customInput && { 
          customInput: customInput 
        }),
        // Si no usa input personalizado y hay test cases, ejecutarlos
        ...(!useCustomInput && attempt.exam.testCases && {
          testCases: attempt.exam.testCases
        })
      };

      const response = await fetch(`${API_BASE_URL}/code-execution/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        setExecutionResult(result);
      } else {
        const errorData = await response.json();
        setExecutionResult({
          error: errorData.error || 'Error al ejecutar el código'
        });
      }
    } catch (error) {
      console.error('Error executing code:', error);
      setExecutionResult({
        error: 'Error de conexión al ejecutar el código'
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!calificacionManual || calificacionManual === '') {
      return;
    }

    const grade = parseFloat(calificacionManual);
    if (isNaN(grade) || grade < 0 || grade > 100) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/exam-attempts/${attemptId}/manual-grade`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          calificacionManual: grade
        })
      });

      if (response.ok) {
        if (onSave) onSave();
        if (onClose) onClose();
      } else {
        const errorData = await response.json();
        console.error('Error al guardar:', errorData);
      }
    } catch (error) {
      console.error('Error saving grade:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div className="loading-container">
            <div className="modern-spinner"></div>
            <p>Cargando intento...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div className="modern-card-body text-center">
            <h4>Error al cargar el intento</h4>
            <button className="modern-btn modern-btn-secondary mt-3" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentFiles = getCurrentFiles();
  const currentFile = currentFiles[selectedFileIndex];

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modern-card-header">
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="modern-card-title mb-0">
              <i className="fas fa-user-edit me-2"></i>
              Corrección Manual - {attempt.user.nombre}
            </h3>
            <button 
              className="btn-close" 
              onClick={onClose}
              aria-label="Cerrar"
            ></button>
          </div>
        </div>

        <div className="modern-card-body" style={{ maxHeight: 'calc(90vh - 180px)', overflowY: 'auto' }}>
          {/* Información de calificaciones */}
          <div className="row mb-4">
            {attempt.puntaje !== null && (
              <div className="col-md-6 mb-3">
                <div className="modern-card" style={{ 
                  height: '100%',
                  border: '2px solid #0d6efd',
                  background: 'linear-gradient(135deg, rgba(13, 110, 253, 0.05) 0%, rgba(13, 110, 253, 0.02) 100%)'
                }}>
                  <div className="modern-card-body text-center">
                    <div style={{ 
                      fontSize: '1.8rem', 
                      color: '#0d6efd',
                      marginBottom: '8px'
                    }}>
                      <i className="fas fa-robot"></i>
                    </div>
                    <h6 className="text-muted mb-2" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Puntaje Automático
                    </h6>
                    <h2 className="mb-2" style={{ 
                      color: '#0d6efd',
                      fontWeight: 'bold',
                      fontSize: '2.5rem'
                    }}>
                      {attempt.puntaje.toFixed(1)}%
                    </h2>
                    {attempt.exam.tipo === 'programming' && (
                      <div style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#e7f3ff',
                        border: '1px solid #0d6efd',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: '#084298',
                        textAlign: 'left'
                      }}>
                        <i className="fas fa-info-circle me-1"></i>
                        Calculado sobre <strong>{attempt.exam.lenguajeProgramacion === 'python' ? 'main.py' : 'main.js'}</strong> (versión manual guardada)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className={attempt.puntaje !== null ? "col-md-6 mb-3" : "col-12 mb-3"}>
              <div className="modern-card" style={{ 
                height: '100%',
                border: attempt.calificacionManual !== null ? '2px solid #198754' : '2px solid #ffc107',
                background: attempt.calificacionManual !== null 
                  ? 'linear-gradient(135deg, rgba(25, 135, 84, 0.05) 0%, rgba(25, 135, 84, 0.02) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 193, 7, 0.05) 0%, rgba(255, 193, 7, 0.02) 100%)'
              }}>
                <div className="modern-card-body text-center">
                  <div style={{ 
                    fontSize: '1.8rem', 
                    color: attempt.calificacionManual !== null ? '#198754' : '#ffc107',
                    marginBottom: '8px'
                  }}>
                    <i className={attempt.calificacionManual !== null ? "fas fa-check-circle" : "fas fa-exclamation-triangle"}></i>
                  </div>
                  <h6 className="text-muted mb-2" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Calificación Manual
                  </h6>
                  {attempt.calificacionManual !== null ? (
                    <h2 className="mb-0" style={{ 
                      color: '#198754',
                      fontWeight: 'bold',
                      fontSize: '2.5rem'
                    }}>
                      {attempt.calificacionManual}
                    </h2>
                  ) : (
                    <h4 className="mb-0" style={{ 
                      color: '#ffc107',
                      fontWeight: '600',
                      fontSize: '1.2rem'
                    }}>
                      Pendiente de corrección
                    </h4>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Para exámenes de programación */}
          {attempt.exam.tipo === 'programming' && (
            <>
              {/* Enunciado */}
              <div className="modern-card mb-3">
                <div className="modern-card-header">
                  <h5 className="modern-card-title mb-0">
                    <i className="fas fa-puzzle-piece me-2"></i>
                    Enunciado del Problema
                  </h5>
                </div>
                <div className="modern-card-body">
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '0.95rem',
                    lineHeight: '1.6',
                    margin: 0,
                    padding: '1rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '0.5rem',
                    border: '1px solid #dee2e6'
                  }}>
                    {attempt.exam.enunciadoProgramacion || 'No hay enunciado definido'}
                  </pre>
                </div>
              </div>

              {/* Selector de versión de archivos */}
              {(attempt.manualFiles.length > 0 || attempt.submissionFiles.length > 0) && (
                <div className="mb-3">
                  <label className="form-label fw-bold">
                    <i className="fas fa-code-branch me-2"></i>
                    Versión de Archivos:
                  </label>
                  <div className="btn-group w-100" role="group">
                    <button
                      type="button"
                      className={`btn ${fileVersion === 'manual' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => handleVersionChange('manual')}
                    >
                      <i className="fas fa-save me-2"></i>
                      Guardados Manuales
                      {attempt.manualFiles.length > 0 && (
                        <span className="badge bg-light text-dark ms-2">{attempt.manualFiles.length}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={`btn ${fileVersion === 'submission' ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => handleVersionChange('submission')}
                    >
                      <i className="fas fa-paper-plane me-2"></i>
                      Entrega Final
                      {attempt.submissionFiles.length > 0 && (
                        <span className="badge bg-light text-dark ms-2">{attempt.submissionFiles.length}</span>
                      )}
                    </button>
                  </div>
                  <div className="form-text">
                    {fileVersion === 'submission' 
                      ? 'Archivos enviados al finalizar el examen'
                      : 'Archivos guardados durante el examen (Ctrl+S)'
                    }
                  </div>
                </div>
              )}

              {/* Selector de archivos */}
              {currentFiles.length > 0 && (
                <div className="mb-3">
                  <label className="form-label fw-bold">
                    <i className="fas fa-file-code me-2"></i>
                    Archivo:
                  </label>
                  <select 
                    className="form-select"
                    value={selectedFileIndex}
                    onChange={(e) => handleFileChange(parseInt(e.target.value))}
                  >
                    {currentFiles.map((file, index) => (
                      <option key={index} value={index}>
                        {file.filename}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Editor de código (en memoria) */}
              {currentFile && (
                <div className="mb-3">
                  <label className="form-label fw-bold">
                    <i className="fas fa-edit me-2"></i>
                    Código (editable en memoria - no se guarda):
                  </label>
                  <textarea
                    className="form-control"
                    style={{
                      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                      fontSize: '14px',
                      minHeight: '300px',
                      backgroundColor: '#1e1e1e',
                      color: '#d4d4d4',
                      border: '1px solid #444'
                    }}
                    value={editedCode}
                    onChange={(e) => setEditedCode(e.target.value)}
                    spellCheck={false}
                  />
                  <div className="form-text text-warning">
                    <i className="fas fa-info-circle me-1"></i>
                    Los cambios son solo para prueba. No se guardarán en el intento del alumno.
                  </div>
                </div>
              )}

              {/* Opciones de ejecución */}
              <div className="mb-3">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="useCustomInput"
                    checked={useCustomInput}
                    onChange={(e) => setUseCustomInput(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="useCustomInput">
                    Usar entrada personalizada (en lugar de test cases)
                  </label>
                </div>
                {useCustomInput && (
                  <div className="mt-2">
                    <label className="form-label">Input personalizado:</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="Ingresa el input que recibirá el programa..."
                    />
                  </div>
                )}
              </div>

              {/* Botón de ejecución */}
              <div className="mb-3">
                <button
                  className="modern-btn modern-btn-primary w-100"
                  onClick={handleExecute}
                  disabled={executing || !currentFile}
                >
                  {executing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-play me-2"></i>
                      Ejecutar Código
                    </>
                  )}
                </button>
              </div>

              {/* Resultado de ejecución */}
              {executionResult && (
                <div className="modern-card mb-3">
                  <div className="modern-card-header">
                    <h5 className="modern-card-title mb-0">
                      <i className="fas fa-terminal me-2"></i>
                      Resultado de Ejecución
                    </h5>
                  </div>
                  <div className="modern-card-body">
                    {executionResult.error ? (
                      <div className="alert alert-danger mb-0">
                        <strong>Error:</strong>
                        <pre className="mb-0 mt-2">{executionResult.error}</pre>
                      </div>
                    ) : (
                      <>
                        {executionResult.score !== undefined && (
                          <div className={`alert ${executionResult.score === 100 ? 'alert-success' : executionResult.score >= 50 ? 'alert-warning' : 'alert-danger'} mb-3`}>
                            <strong>Puntaje: {executionResult.score.toFixed(1)}%</strong>
                            <div className="small mt-1">
                              {executionResult.passedTests} de {executionResult.totalTests} tests pasados
                            </div>
                          </div>
                        )}

                        {executionResult.testResults && executionResult.testResults.length > 0 && (
                          <div>
                            <h6>Resultados por Test:</h6>
                            {executionResult.testResults.map((test, idx) => (
                              <div key={idx} className={`alert ${test.passed ? 'alert-success' : 'alert-danger'} mb-2`}>
                                <div className="d-flex justify-content-between">
                                  <strong>Test {idx + 1}</strong>
                                  <span>{test.passed ? '✓ Pasado' : '✗ Fallido'}</span>
                                </div>
                                {test.input && <div className="small mt-1"><strong>Input:</strong> {test.input}</div>}
                                {test.expectedOutput && <div className="small"><strong>Esperado:</strong> {test.expectedOutput}</div>}
                                {test.actualOutput && <div className="small"><strong>Obtenido:</strong> {test.actualOutput}</div>}
                                {test.error && <div className="small text-danger"><strong>Error:</strong> {test.error}</div>}
                              </div>
                            ))}
                          </div>
                        )}

                        {executionResult.output && !executionResult.testResults && (
                          <div>
                            <h6>Salida:</h6>
                            <pre style={{
                              backgroundColor: '#f8f9fa',
                              padding: '1rem',
                              borderRadius: '0.5rem',
                              border: '1px solid #dee2e6',
                              whiteSpace: 'pre-wrap',
                              wordWrap: 'break-word'
                            }}>
                              {executionResult.output}
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Para exámenes múltiple choice */}
          {attempt.exam.tipo === 'multiple_choice' && (
            <div className="modern-card mb-3">
              <div className="modern-card-header">
                <h5 className="modern-card-title mb-0">
                  <i className="fas fa-list-check me-2"></i>
                  Respuestas del Estudiante
                </h5>
              </div>
              <div className="modern-card-body">
                {attempt.exam.preguntas.map((pregunta, idx) => {
                  const respuestaEstudiante = attempt.respuestas[pregunta.id];
                  const esCorrecta = respuestaEstudiante === pregunta.correcta;
                  
                  return (
                    <div key={pregunta.id} className="mb-3 p-3 border rounded">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6 className="mb-1">Pregunta {idx + 1}</h6>
                        <span className={`badge ${esCorrecta ? 'bg-success' : 'bg-danger'}`}>
                          {esCorrecta ? '✓ Correcta' : '✗ Incorrecta'}
                        </span>
                      </div>
                      <p className="mb-2">{pregunta.texto}</p>
                      <div className="ms-3">
                        {pregunta.opciones.map((opcion, opIdx) => (
                          <div 
                            key={opIdx} 
                            className={`p-2 mb-1 rounded ${
                              opIdx === pregunta.correcta ? 'bg-success bg-opacity-10 border border-success' :
                              opIdx === respuestaEstudiante ? 'bg-danger bg-opacity-10 border border-danger' :
                              'bg-light'
                            }`}
                          >
                            {opIdx === pregunta.correcta && <i className="fas fa-check-circle text-success me-2"></i>}
                            {opIdx === respuestaEstudiante && opIdx !== pregunta.correcta && <i className="fas fa-times-circle text-danger me-2"></i>}
                            {opcion}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Calificación Manual */}
          <div className="modern-card">
            <div className="modern-card-header">
              <h5 className="modern-card-title mb-0">
                <i className="fas fa-clipboard-check me-2"></i>
                Calificación Manual
              </h5>
            </div>
            <div className="modern-card-body">
              <div className="mb-3">
                <label className="form-label fw-bold">
                  Calificación (0-100):
                </label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  max="100"
                  step="0.1"
                  value={calificacionManual}
                  onChange={(e) => setCalificacionManual(e.target.value)}
                  placeholder="Ingrese la calificación..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer con botones */}
        <div className="modern-card-footer">
          <div className="d-flex justify-content-end gap-2">
            <button 
              className="modern-btn modern-btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              <i className="fas fa-times me-2"></i>
              Cancelar
            </button>
            <button 
              className="modern-btn modern-btn-success"
              onClick={handleSaveGrade}
              disabled={saving || !calificacionManual}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>
                  Guardar Calificación
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '95%',
    maxWidth: '1400px',
    maxHeight: '95vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden'
  }
};
