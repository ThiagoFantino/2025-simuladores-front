// src/pages/ExamCreator.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Editor from '@monaco-editor/react';
import { useModal } from "../hooks";
import BackToMainButton from "../components/BackToMainButton";
import Modal from "../components/Modal";
import { createExam, testSolutionPreview } from "../services/api";

const ExamCreator = () => {
  const navigate = useNavigate();
  const { modal, showModal, closeModal } = useModal();
  const [titulo, setTitulo] = useState("");
  const [tipoExamen, setTipoExamen] = useState("multiple_choice"); // "multiple_choice" | "programming"
  
  // Estados para exámenes de multiple choice
  const [preguntas, setPreguntas] = useState([]);
  const [textoPregunta, setTextoPregunta] = useState("");
  const [opciones, setOpciones] = useState(["", ""]);
  const [correcta, setCorrecta] = useState(0);
  
  // Estados para exámenes de programación
  const [lenguajeProgramacion, setLenguajeProgramacion] = useState("python");
  const [intellisenseHabilitado, setIntellisenseHabilitado] = useState(false);
  const [enunciadoProgramacion, setEnunciadoProgramacion] = useState("");
  const [codigoInicial, setCodigoInicial] = useState("");
  const [testCases, setTestCases] = useState([
    { description: "", input: "", expectedOutput: "" }
  ]);
  const [solucionReferencia, setSolucionReferencia] = useState("");
  const [codigoTemporal, setCodigoTemporal] = useState("");
  const [testResults, setTestResults] = useState(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('temporal'); // 'temporal' | 'reference'
  
  const [error, setError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);

  // Agregar opción nueva
  const handleAgregarOpcion = () => {
    if (opciones.length < 10) { // Máximo 10 opciones
      setOpciones([...opciones, ""]);
    }
  };

  // Eliminar opción
  const handleEliminarOpcion = (index) => {
    if (opciones.length > 2) { // Mínimo 2 opciones
      const nuevasOpciones = opciones.filter((_, i) => i !== index);
      setOpciones(nuevasOpciones);
      // Ajustar la respuesta correcta si es necesario
      if (correcta >= nuevasOpciones.length) {
        setCorrecta(nuevasOpciones.length - 1);
      }
    }
  };

  // Agregar pregunta al listado
  const handleAgregarPregunta = () => {
    if (!textoPregunta.trim()) {
      setError("Ingrese el texto de la pregunta");
      return;
    }
    
    if (opciones.length < 2) {
      setError("La pregunta debe tener al menos 2 opciones");
      return;
    }
    
    if (opciones.some(o => !o.trim())) {
      setError("Complete todas las opciones antes de agregar la pregunta");
      return;
    }

    setPreguntas([
      ...preguntas,
      { texto: textoPregunta, opciones: [...opciones], correcta }
    ]);

    // Limpiar inputs
    setTextoPregunta("");
    setOpciones(["", ""]);
    setCorrecta(0);
    setError("");
  };

  // Funciones para manejar test cases
  const handleAddTestCase = () => {
    setTestCases([...testCases, { description: "", input: "", expectedOutput: "" }]);
  };

  const handleRemoveTestCase = (index) => {
    if (testCases.length > 1) {
      setTestCases(testCases.filter((_, i) => i !== index));
    }
  };

  const handleTestCaseChange = (index, field, value) => {
    const updatedTestCases = [...testCases];
    updatedTestCases[index][field] = value;
    setTestCases(updatedTestCases);
  };

  // Función para ejecutar tests contra código temporal
  const handleRunTestsTemporary = async () => {
    console.log('Ejecutando tests temporales...');
    console.log('Código:', codigoTemporal);
    console.log('Test cases:', testCases);
    console.log('Lenguaje:', lenguajeProgramacion);
    
    if (!codigoTemporal.trim()) {
      const errorMsg = "Debes ingresar código para probar";
      setError(errorMsg);
      console.error('Validación falló:', errorMsg);
      alert(errorMsg);
      return;
    }

    if (testCases.length === 0) {
      const errorMsg = "No hay test cases configurados";
      setError(errorMsg);
      console.error('Validación falló:', errorMsg);
      alert(errorMsg);
      return;
    }

    // Validar que todos los test cases tengan al menos expectedOutput
    const invalidTests = testCases.filter(tc => !tc.expectedOutput || !tc.expectedOutput.trim());
    if (invalidTests.length > 0) {
      const errorMsg = `Hay ${invalidTests.length} test case(s) sin output esperado. Por favor completa todos los test cases antes de ejecutar.`;
      setError(errorMsg);
      console.error('Validación falló:', errorMsg);
      console.error('Test cases inválidos:', invalidTests);
      alert(errorMsg);
      // Scroll hacia arriba para mostrar el error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsRunningTests(true);
    setError("");
    
    try {
      console.log('Llamando a testSolutionPreview...');
      // Filtrar solo los test cases válidos (con expectedOutput)
      const validTestCases = testCases.filter(tc => tc.expectedOutput && tc.expectedOutput.trim());
      const results = await testSolutionPreview(codigoTemporal, lenguajeProgramacion, validTestCases);
      console.log('Resultados:', results);
      setTestResults(results);
      setShowTestPanel(true);
    } catch (err) {
      console.error("Error ejecutando tests:", err);
      const errorMsg = err.message || "Error al ejecutar tests";
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Función para ejecutar tests contra solución de referencia
  const handleRunTestsReference = async () => {
    console.log('Ejecutando tests con solución de referencia...');
    
    if (!solucionReferencia.trim()) {
      const errorMsg = "Debes ingresar una solución de referencia para probar";
      setError(errorMsg);
      console.error('Validación falló:', errorMsg);
      alert(errorMsg);
      return;
    }

    if (testCases.length === 0) {
      const errorMsg = "No hay test cases configurados";
      setError(errorMsg);
      console.error('Validación falló:', errorMsg);
      alert(errorMsg);
      return;
    }

    const invalidTests = testCases.filter(tc => !tc.expectedOutput || !tc.expectedOutput.trim());
    if (invalidTests.length > 0) {
      const errorMsg = `Hay ${invalidTests.length} test case(s) sin output esperado. Por favor completa todos los test cases antes de ejecutar.`;
      setError(errorMsg);
      console.error('Validación falló:', errorMsg);
      console.error('Test cases inválidos:', invalidTests);
      alert(errorMsg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsRunningTests(true);
    setError("");
    
    try {
      console.log('Llamando a testSolutionPreview...');
      const validTestCases = testCases.filter(tc => tc.expectedOutput && tc.expectedOutput.trim());
      const results = await testSolutionPreview(solucionReferencia, lenguajeProgramacion, validTestCases);
      console.log('Resultados:', results);
      setTestResults(results);
      setShowTestPanel(true);
    } catch (err) {
      console.error("Error ejecutando tests:", err);
      const errorMsg = err.message || "Error al ejecutar tests";
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Función que realmente publica el examen
  const proceedWithPublishing = async () => {
    setIsPublishing(true);
    try {
      const examData = {
        titulo,
        tipo: tipoExamen
      };

      // Agregar datos específicos según el tipo
      if (tipoExamen === "multiple_choice") {
        examData.preguntas = preguntas;
      } else if (tipoExamen === "programming") {
        examData.lenguajeProgramacion = lenguajeProgramacion;
        examData.intellisenseHabilitado = intellisenseHabilitado;
        examData.enunciadoProgramacion = enunciadoProgramacion;
        examData.codigoInicial = codigoInicial;
        examData.testCases = testCases;
        examData.solucionReferencia = solucionReferencia;
      }

      await createExam(examData);
      
      // Volver a la Página Principal
      navigate("/principal");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // Publicar examen
  const handlePublicarExamen = async () => {
    if (isPublishing) return; // Prevenir múltiples clicks
    
    if (!titulo) {
      setError("Ingrese un título para el examen");
      return;
    }

    // Validaciones específicas según el tipo
    if (tipoExamen === "multiple_choice") {
      if (preguntas.length === 0) {
        showModal(
          'warning',
          '⚠️ No se puede publicar el examen',
          'No se puede publicar un examen sin preguntas. Por favor, agrega al menos una pregunta antes de continuar.',
          null,
          false
        );
        return;
      }
    } else if (tipoExamen === "programming") {
      if (!enunciadoProgramacion.trim()) {
        showModal(
          'warning',
          '⚠️ No se puede publicar el examen',
          'No se puede publicar un examen de programación sin consigna. Por favor, ingresa el enunciado del problema antes de continuar.',
          null,
          false
        );
        return;
      }
    }

    // Si llegamos aquí, todo está bien, publicar directamente
    proceedWithPublishing();
  };

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="modern-card mb-4">
        <div className="modern-card-header">
          <div className="exam-creator-header">
            <div className="exam-creator-title-section">
              <h1 className="page-title mb-1">
                <i className="fas fa-plus-circle me-2" style={{ color: 'var(--primary-color)' }}></i>
                <span className="title-text">Crear Examen</span>
              </h1>
              <p className="page-subtitle mb-0">Diseña un nuevo examen con preguntas personalizadas</p>
            </div>
            <div className="exam-creator-actions">
              <BackToMainButton />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message mb-4">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}


        {/* Información del examen */}
        <div className="modern-card mb-4">
          <div className="modern-card-header">
            <h3 className="modern-card-title">
              <i className="fas fa-edit me-2"></i>
              Información del Examen
            </h3>
          </div>
          <div className="modern-card-body">
            <div className="mb-3">
              <label className="form-label d-flex align-items-center gap-2">
                <i className="fas fa-heading text-muted"></i>
                Título del Examen
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ingresa el título del examen"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                style={{
                  padding: '0.75rem 1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              />
            </div>
            
            <div className="mb-0">
              <label className="form-label d-flex align-items-center gap-2">
                <i className="fas fa-clipboard-list text-muted"></i>
                Tipo de Examen
              </label>
              <select
                className="form-select"
                value={tipoExamen}
                onChange={(e) => setTipoExamen(e.target.value)}
                style={{
                  padding: '0.75rem 1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '1rem'
                }}
              >
                <option value="multiple_choice">Múltiple Choice</option>
                <option value="programming">Programación</option>
              </select>
            </div>
          </div>
        </div>

        {/* Configuración de examen de programación */}
        {tipoExamen === "programming" && (
          <div className="modern-card mb-4">
            <div className="modern-card-header">
              <h3 className="modern-card-title">
                <i className="fas fa-code me-2"></i>
                Configuración de Programación
              </h3>
            </div>
            <div className="modern-card-body">
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label d-flex align-items-center gap-2">
                    <i className="fas fa-terminal text-muted"></i>
                    Lenguaje de Programación
                  </label>
                  <select
                    className="form-select"
                    value={lenguajeProgramacion}
                    onChange={(e) => setLenguajeProgramacion(e.target.value)}
                    style={{
                      padding: '0.75rem 1rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                  </select>
                </div>
                
                <div className="col-md-6 mb-3">
                  <label className="form-label d-flex align-items-center gap-2">
                    <i className="fas fa-lightbulb text-muted"></i>
                    Intellisense y Autocompletado
                  </label>
                  <div className="form-check form-switch mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="intellisenseSwitch"
                      checked={intellisenseHabilitado}
                      onChange={(e) => setIntellisenseHabilitado(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="intellisenseSwitch">
                      {intellisenseHabilitado ? "Habilitado" : "Deshabilitado"}
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mb-3">
                <label className="form-label d-flex align-items-center gap-2">
                  <i className="fas fa-file-alt text-muted"></i>
                  Enunciado del Problema
                </label>
                <textarea
                  className="form-control"
                  rows="6"
                  placeholder="Describe detalladamente el problema que deben resolver los estudiantes..."
                  value={enunciadoProgramacion}
                  onChange={(e) => setEnunciadoProgramacion(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
              
              <div className="mb-0">
                <label className="form-label d-flex align-items-center gap-2">
                  <i className="fas fa-code text-muted"></i>
                  Código Inicial (Opcional)
                </label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder={`Código inicial para ${lenguajeProgramacion}...`}
                  value={codigoInicial}
                  onChange={(e) => setCodigoInicial(e.target.value)}
                  style={{
                    padding: '0.75rem 1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    backgroundColor: '#f8f9fa'
                  }}
                />
                <small className="form-text text-muted">
                  Código que aparecerá precargado en el editor del estudiante
                </small>
              </div>
            </div>
          </div>
        )}

        {/* Test Cases para exámenes de programación */}
        {tipoExamen === "programming" && (
          <div className="modern-card mb-4">
            <div className="modern-card-header">
              <h3 className="modern-card-title">
                <i className="fas fa-vial me-2"></i>
                Test Cases (Evaluación Automática)
              </h3>
            </div>
            <div className="modern-card-body">
              <div className="alert alert-info mb-3">
                <i className="fas fa-info-circle me-2"></i>
                <strong>Define los casos de prueba que se ejecutarán automáticamente.</strong>
                <ul className="mb-0 mt-2">
                  <li>Los test cases NO son visibles para los estudiantes</li>
                  <li>El puntaje se calcula como: <strong>(tests pasados / total tests) × 100</strong></li>
                  <li>Ejemplo: 3 de 4 tests correctos = 75%</li>
                </ul>
              </div>

              {testCases.map((testCase, index) => (
                <div key={index} className="card mb-3" style={{ border: '1px solid var(--border-color)' }}>
                  <div className="card-header d-flex justify-content-between align-items-center" style={{ backgroundColor: '#f8f9fa' }}>
                    <strong>
                      <i className="fas fa-flask me-2"></i>
                      Test Case {index + 1}
                    </strong>
                    {testCases.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleRemoveTestCase(index)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <label className="form-label">Descripción del Test</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej: Suma de números positivos"
                        value={testCase.description}
                        onChange={(e) => handleTestCaseChange(index, 'description', e.target.value)}
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Input (una línea por entrada)</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="2&#10;3"
                          value={testCase.input}
                          onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)}
                          style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                        />
                        <small className="form-text text-muted">
                          Deja vacío si el código no requiere input. Cada línea será una entrada separada.
                        </small>
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Output Esperado</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="5"
                          value={testCase.expectedOutput}
                          onChange={(e) => handleTestCaseChange(index, 'expectedOutput', e.target.value)}
                          style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                        />
                        <small className="form-text text-muted">
                          Resultado exacto que debe producir el código
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={handleAddTestCase}
              >
                <i className="fas fa-plus me-2"></i>
                Agregar Test Case
              </button>

              <div className="alert alert-success mt-3 mb-0">
                <i className="fas fa-calculator me-2"></i>
                <strong>Total: {testCases.length} test case{testCases.length !== 1 ? 's' : ''}</strong>
                <br/>
                <small>
                  Cada test vale <strong>{testCases.length > 0 ? (100 / testCases.length).toFixed(1) : 0}%</strong> del puntaje final.
                  El puntaje se calcula automáticamente.
                </small>
              </div>
            </div>
          </div>
        )}

        {/* Solución de Referencia y Testing - Solo para exámenes de programación */}
        {tipoExamen === "programming" && testCases.length > 0 && (
          <div className="modern-card mb-4">
            <div className="modern-card-header">
              <h3 className="modern-card-title">
                <i className="fas fa-check-double me-2"></i>
                Validar Tests (Herramientas del Profesor)
              </h3>
            </div>
            <div className="modern-card-body">
              <div className="alert alert-warning mb-3">
                <i className="fas fa-lock me-2"></i>
                <strong>Privado - Solo visible para el profesor</strong>
                <ul className="mb-0 mt-2">
                  <li>Usa estas herramientas para validar que tus tests funcionan correctamente</li>
                  <li>La solución de referencia y los resultados NUNCA serán visibles para los estudiantes</li>
                  <li>Puedes probar código temporal o guardar una solución de referencia</li>
                </ul>
              </div>

              {/* Tabs para seleccionar entre código temporal y solución de referencia */}
              <ul className="nav nav-tabs mb-3" role="tablist">
                <li className="nav-item" role="presentation">
                  <button 
                    className={`nav-link ${activeTab === 'temporal' ? 'active' : ''}`}
                    onClick={() => setActiveTab('temporal')}
                    type="button"
                  >
                    <i className="fas fa-flask me-2"></i>
                    Código Temporal
                  </button>
                </li>
                <li className="nav-item" role="presentation">
                  <button 
                    className={`nav-link ${activeTab === 'reference' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reference')}
                    type="button"
                  >
                    <i className="fas fa-save me-2"></i>
                    Solución de Referencia
                  </button>
                </li>
              </ul>

              <div className="tab-content">
                {/* Tab de Código Temporal */}
                {activeTab === 'temporal' && (
                  <div className="tab-pane-custom fade show active">
                    <div style={{ 
                      border: '1px solid #dee2e6', 
                      borderRadius: '8px', 
                      overflow: 'hidden',
                      backgroundColor: '#1e1e1e'
                    }}>
                    {/* Header del editor */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 16px',
                      backgroundColor: '#2d2d30',
                      borderBottom: '1px solid #3e3e42',
                      color: '#cccccc'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-file-code"></i>
                        <span style={{ fontSize: '14px', fontWeight: '500' }}>
                          prueba.{lenguajeProgramacion === 'python' ? 'py' : 'js'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRunTestsTemporary();
                        }}
                        disabled={isRunningTests || !codigoTemporal.trim()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px'
                        }}
                      >
                        {isRunningTests ? (
                          <>
                            <div className="spinner-border spinner-border-sm" role="status"></div>
                            Ejecutando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-play"></i>
                            Ejecutar Tests
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Editor Monaco */}
                    <Editor
                      height="500px"
                      language={lenguajeProgramacion}
                      value={codigoTemporal}
                      onChange={(value) => setCodigoTemporal(value || '')}
                      theme="vs-dark"
                      options={{
                        selectOnLineNumbers: true,
                        roundedSelection: false,
                        readOnly: false,
                        cursorStyle: 'line',
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        minimap: { enabled: true },
                        fontSize: 14,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        tabSize: lenguajeProgramacion === 'python' ? 4 : 2,
                        quickSuggestions: intellisenseHabilitado,
                        suggestOnTriggerCharacters: intellisenseHabilitado,
                        parameterHints: { enabled: intellisenseHabilitado },
                        suggest: {
                          showMethods: intellisenseHabilitado,
                          showFunctions: intellisenseHabilitado,
                          showConstructors: intellisenseHabilitado,
                          showFields: intellisenseHabilitado,
                          showVariables: intellisenseHabilitado,
                          showClasses: intellisenseHabilitado,
                          showKeywords: intellisenseHabilitado
                        }
                      }}
                    />
                  </div>
                  <small className="form-text text-muted d-block mt-2">
                    <i className="fas fa-info-circle me-1"></i>
                    Este código es temporal y no se guardará. Úsalo para probar rápidamente tus tests.
                  </small>
                </div>
                )}

                {/* Tab de Solución de Referencia */}
                {activeTab === 'reference' && (
                  <div className="tab-pane-custom fade show active">
                    <div style={{ 
                      border: '1px solid #dee2e6', 
                      borderRadius: '8px', 
                      overflow: 'hidden',
                      backgroundColor: '#1e1e1e'
                    }}>
                    {/* Header del editor */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 16px',
                      backgroundColor: '#2d2d30',
                      borderBottom: '1px solid #3e3e42',
                      color: '#cccccc'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-star" style={{ color: '#ffd700' }}></i>
                        <span style={{ fontSize: '14px', fontWeight: '500' }}>
                          solucion_referencia.{lenguajeProgramacion === 'python' ? 'py' : 'js'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRunTestsReference();
                        }}
                        disabled={isRunningTests || !solucionReferencia.trim()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px'
                        }}
                      >
                        {isRunningTests ? (
                          <>
                            <div className="spinner-border spinner-border-sm" role="status"></div>
                            Ejecutando...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-play"></i>
                            Ejecutar Tests
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Editor Monaco */}
                    <Editor
                      height="500px"
                      language={lenguajeProgramacion}
                      value={solucionReferencia}
                      onChange={(value) => setSolucionReferencia(value || '')}
                      theme="vs-dark"
                      options={{
                        selectOnLineNumbers: true,
                        roundedSelection: false,
                        readOnly: false,
                        cursorStyle: 'line',
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        minimap: { enabled: true },
                        fontSize: 14,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        tabSize: lenguajeProgramacion === 'python' ? 4 : 2,
                        quickSuggestions: intellisenseHabilitado,
                        suggestOnTriggerCharacters: intellisenseHabilitado,
                        parameterHints: { enabled: intellisenseHabilitado },
                        suggest: {
                          showMethods: intellisenseHabilitado,
                          showFunctions: intellisenseHabilitado,
                          showConstructors: intellisenseHabilitado,
                          showFields: intellisenseHabilitado,
                          showVariables: intellisenseHabilitado,
                          showClasses: intellisenseHabilitado,
                          showKeywords: intellisenseHabilitado
                        }
                      }}
                    />
                  </div>
                  <small className="form-text text-muted d-block mt-2">
                    <i className="fas fa-lock me-1"></i>
                    Esta solución se guardará con el examen y solo será visible para ti.
                    Te permite validar que tus tests están correctos.
                  </small>
                </div>
                )}
              </div>

              {/* Panel de Resultados de Tests */}
              {showTestPanel && testResults && (
                <div className="mt-4">
                  <h5 className="mb-3">
                    <i className="fas fa-chart-bar me-2"></i>
                    Resultados de la Ejecución
                  </h5>
                  
                  <div className={`alert ${testResults.score === 100 ? 'alert-success' : testResults.score >= 50 ? 'alert-warning' : 'alert-danger'}`}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>Puntaje: {testResults.score.toFixed(1)}%</strong>
                        <br />
                        <small>
                          {testResults.passedTests} de {testResults.totalTests} tests pasados
                        </small>
                      </div>
                      <div>
                        {testResults.score === 100 ? (
                          <i className="fas fa-check-circle fa-2x text-success"></i>
                        ) : (
                          <i className="fas fa-exclamation-triangle fa-2x text-warning"></i>
                        )}
                      </div>
                    </div>
                  </div>

                  {testResults.testResults.map((result, index) => (
                    <div key={index} className="card mb-2" style={{ border: `2px solid ${result.passed ? '#28a745' : '#dc3545'}` }}>
                      <div className="card-header d-flex justify-content-between align-items-center" 
                           style={{ backgroundColor: result.passed ? '#d4edda' : '#f8d7da' }}>
                        <strong>
                          {result.passed ? (
                            <i className="fas fa-check-circle text-success me-2"></i>
                          ) : (
                            <i className="fas fa-times-circle text-danger me-2"></i>
                          )}
                          Test {index + 1}: {result.description || `Test Case ${index + 1}`}
                        </strong>
                        <span className="badge" style={{ 
                          backgroundColor: result.passed ? '#28a745' : '#dc3545',
                          color: 'white'
                        }}>
                          {result.passed ? 'PASÓ' : 'FALLÓ'}
                        </span>
                      </div>
                      <div className="card-body">
                        {result.input && (
                          <div className="mb-2">
                            <strong>Input:</strong>
                            <pre className="mb-0 p-2" style={{ 
                              backgroundColor: '#f8f9fa', 
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>{result.input}</pre>
                          </div>
                        )}
                        <div className="row">
                          <div className="col-md-6 mb-2">
                            <strong>Output Esperado:</strong>
                            <pre className="mb-0 p-2" style={{ 
                              backgroundColor: '#e7f5e7', 
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              border: '1px solid #c3e6c3'
                            }}>{result.expectedOutput}</pre>
                          </div>
                          <div className="col-md-6 mb-2">
                            <strong>Output Obtenido:</strong>
                            <pre className="mb-0 p-2" style={{ 
                              backgroundColor: result.passed ? '#e7f5e7' : '#f8d7da', 
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              border: `1px solid ${result.passed ? '#c3e6c3' : '#f5c6cb'}`
                            }}>{result.actualOutput || '(sin output)'}</pre>
                          </div>
                        </div>
                        {result.error && (
                          <div className="mt-2">
                            <strong className="text-danger">Error:</strong>
                            <pre className="mb-0 p-2 text-danger" style={{ 
                              backgroundColor: '#fff3cd', 
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>{result.error}</pre>
                          </div>
                        )}
                        <small className="text-muted d-block mt-2">
                          Tiempo de ejecución: {result.executionTime}ms
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agregar pregunta - Solo para múltiple choice */}
        {tipoExamen === "multiple_choice" && (
          <div className="modern-card mb-4">
            <div className="modern-card-header">
              <h3 className="modern-card-title">
                <i className="fas fa-question-circle me-2"></i>
                Agregar Pregunta
              </h3>
            </div>
          <div className="modern-card-body">
          <div className="mb-4">
            <label className="form-label d-flex align-items-center gap-2">
              <i className="fas fa-comment-alt text-muted"></i>
              Texto de la pregunta
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Escribe aquí tu pregunta"
              value={textoPregunta}
              onChange={(e) => setTextoPregunta(e.target.value)}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            />
          </div>

          <div className="mb-4">
            <label className="form-label d-flex align-items-center gap-2">
              <i className="fas fa-list text-muted"></i>
              Opciones de respuesta (mínimo 2, máximo 10)
            </label>
            <div className="exam-creator-options-list">
              {opciones.map((op, i) => (
                <div key={i} className="exam-creator-option-item mb-2 d-flex gap-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder={`Opción ${i + 1}`}
                    value={op}
                    onChange={(e) => {
                      const nuevasOpciones = [...opciones];
                      nuevasOpciones[i] = e.target.value;
                      setOpciones(nuevasOpciones);
                    }}
                    style={{
                      padding: '0.6rem 0.8rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '0.9rem'
                    }}
                  />
                  {opciones.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleEliminarOpcion(i)}
                      title="Eliminar opción"
                      style={{ minWidth: '40px' }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {opciones.length < 10 && (
              <button
                type="button"
                className="btn btn-outline-primary btn-sm mt-2"
                onClick={handleAgregarOpcion}
              >
                <i className="fas fa-plus me-2"></i>
                Agregar opción
              </button>
            )}
          </div>

          <div className="mb-4">
            <label className="form-label d-flex align-items-center gap-2">
              <i className="fas fa-check-circle text-muted"></i>
              Respuesta correcta
            </label>
            <select
              className="form-select"
              value={correcta}
              onChange={(e) => setCorrecta(Number(e.target.value))}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            >
              {opciones.map((_, i) => (
                <option key={i} value={i}>
                  Opción {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div className="exam-creator-buttons">
            <button 
              className="modern-btn modern-btn-secondary"
              onClick={handleAgregarPregunta}
            >
              <i className="fas fa-plus me-2"></i>
              <span className="button-text">Agregar Pregunta</span>
            </button>
          </div>
        </div>
      </div>
        )}

      {/* Lista de preguntas - Solo para múltiple choice */}
      {tipoExamen === "multiple_choice" && (
        <div className="modern-card">
          <div className="modern-card-header">
            <h3 className="modern-card-title">
              <i className="fas fa-clipboard-list me-2"></i>
              Preguntas Agregadas ({preguntas.length})
            </h3>
          </div>
        <div className="modern-card-body">
          {preguntas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <i className="fas fa-question-circle"></i>
              </div>
              <h4 className="empty-title">No hay preguntas aún</h4>
              <p className="empty-subtitle">
                Agrega tu primera pregunta usando el formulario de arriba
              </p>
            </div>
          ) : (
            <div className="exam-creator-questions-grid">
              {preguntas.map((p, idx) => (
                <div key={idx} className="exam-creator-question-card">
                  <div className="exam-card">
                    <div className="exam-card-header">
                      <h5 className="exam-title">
                        <span className="question-number">Pregunta {idx + 1}</span>
                      </h5>
                      <span className="exam-badge">
                        <i className="fas fa-check-circle"></i>
                        <span className="badge-text">Lista</span>
                      </span>
                    </div>
                    <div className="exam-card-body">
                      <div className="question-text mb-3">
                        <strong>{p.texto}</strong>
                      </div>
                      <div className="exam-info">
                        {p.opciones.map((o, i) => (
                          <div key={i} className="exam-info-item">
                            <i className={i === p.correcta ? "fas fa-check-circle text-success" : "fas fa-circle text-muted"}></i>
                            <span className={i === p.correcta ? "fw-bold text-success" : ""}>{o}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Botón de publicar examen - al final */}
      <div className="modern-card">
        <div className="modern-card-body">
          <div className="text-center">
            <button 
              className="modern-btn modern-btn-primary"
              onClick={handlePublicarExamen}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <>
                  <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                  <span className="button-text">Publicando...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane me-2"></i>
                  <span className="button-text">Publicar Examen</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Component */}
      <Modal
        show={modal.show}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        showCancel={modal.showCancel}
        confirmText={(modal.type === 'warning') ? 'Confirmar' : 'Entendido'}
        cancelText="Cancelar"
      />
    </div>
  );
};

export default ExamCreator;
