const RouteAI = (() => {
  const normalize = text => String(text || '').replace(/\s+/g, ' ').trim();
  const finish = text => /[.!?]$/.test(text) ? text : `${text}.`;
  const cleanPhoneHint = text => normalize(text).replace(/\s+,/g, ',');
  const joinParts = parts => finish(normalize(parts.filter(Boolean).join(' ')));

  const intros = {
    cercano: {
      saludo: d => `Hola ${d.acudiente || 'familia'},`,
      cierre: () => 'Gracias por estar atentos.'
    },
    formal: {
      saludo: d => `Buen día, ${d.acudiente || 'familia'}.`,
      cierre: () => 'Agradecemos su atención.'
    },
    breve: {
      saludo: () => '',
      cierre: () => ''
    }
  };

  const templates = {
    alistando(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        tone === 'breve'
          ? `La ruta ${d.ruta} se está alistando para ${d.estudiante}`
          : `La ruta ${d.ruta} se está alistando para ${d.momento} de ${d.estudiante}`,
        d.extra || 'En pocos minutos iniciaremos el recorrido.',
        tone === 'breve' ? 'Por favor estar atentos' : `Por favor tener listo a ${d.estudiante}.`,
        intro.cierre()
      ]);
    },
    ingresoBarrio(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        tone === 'breve'
          ? `La ruta ${d.ruta} ya ingresó a ${d.barrio}`
          : `La ruta ${d.ruta} ya ingresó al barrio ${d.barrio}.`,
        d.extra || 'Estamos entrando al sector.',
        tone === 'breve' ? `Alistar a ${d.estudiante}` : `Por favor alistar a ${d.estudiante}.`,
        intro.cierre()
      ]);
    },
    cerca(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        tone === 'breve'
          ? `Ruta cerca para ${d.estudiante} en ${d.barrio}`
          : `La ruta ${d.ruta} se encuentra cerca de ${d.barrio} para ${d.momento} de ${d.estudiante}.`,
        d.extra || `Tiempo estimado: ${d.minutos || 4} minutos.`,
        d.nota || '',
        intro.cierre()
      ]);
    },
    retraso(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        tone === 'breve'
          ? `Retraso en ruta ${d.ruta} para ${d.estudiante}`
          : `La ruta ${d.ruta} presenta un retraso para atender a ${d.estudiante}.`,
        d.extra || `El nuevo tiempo estimado es de ${d.minutos || 10} minutos.`,
        tone === 'breve' ? '' : 'Gracias por la comprensión.',
        intro.cierre()
      ]);
    },
    subio(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        tone === 'breve'
          ? `${d.estudiante} ya subió a la ruta`
          : `${d.estudiante} ya subió a la ruta ${d.ruta} sin novedad.`,
        intro.cierre()
      ]);
    },
    noSalio(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        tone === 'breve'
          ? `${d.estudiante} no salió al momento del paso de la ruta`
          : `Se registra que ${d.estudiante} no salió al momento del paso de la ruta.`,
        d.extra || 'Si hubo un cambio, por favor informarlo.',
        intro.cierre()
      ]);
    },
    salidaColegio(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        tone === 'breve'
          ? `La ruta ya salió del colegio con ${d.estudiante}`
          : `La ruta ${d.ruta} ya salió del colegio para iniciar la dejada de ${d.estudiante}.`,
        d.extra || 'Avisaremos cuando vaya cerca.',
        intro.cierre()
      ]);
    },
    llegadaColegio(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        tone === 'breve'
          ? `${d.estudiante} ya llegó al colegio`
          : `${d.estudiante} ya llegó al colegio en la ruta ${d.ruta}.`,
        intro.cierre()
      ]);
    },
    entregado(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        tone === 'breve'
          ? `${d.estudiante} ya fue entregado`
          : `${d.estudiante} ya fue entregado correctamente.`,
        d.extra || '',
        intro.cierre()
      ]);
    },
    personalizado(d, tone) {
      const intro = intros[tone] || intros.cercano;
      return joinParts([
        intro.saludo(d),
        cleanPhoneHint(d.extra || `Compartimos una novedad sobre ${d.estudiante}.`),
        intro.cierre()
      ]);
    }
  };

  function buildMessage(type, tone, data) {
    const safeTone = ['cercano', 'formal', 'breve'].includes(tone) ? tone : 'cercano';
    const generator = templates[type] || templates.personalizado;
    return generator(data || {}, safeTone);
  }

  function improve(text, style = 'amable') {
    const clean = normalize(text);
    if (!clean) return '';
    if (style === 'formal') return finish(clean.replace(/^hola/ig, 'Buen día').replace(/gracias/ig, 'Agradecemos'));
    if (style === 'breve') return finish(clean.split(/(?<=[.!?])\s+/).slice(0, 2).join(' '));
    if (style === 'urgente') return finish(`${clean} Por favor revisar de inmediato.`);
    if (style === 'amable') return finish(`${clean} Muchas gracias por su apoyo.`);
    return finish(clean);
  }

  function answer(prompt, context = {}) {
    const p = normalize(prompt).toLowerCase();
    if (!p) return 'Escribe una instrucción para mejorar mensajes, revisar el orden o pedir una recomendación de envío.';
    if (p.includes('siguiente')) {
      return context.currentStudent
        ? `Sigue ${context.currentStudent.nombre} en ${context.currentStudent.barrio}. Acudiente: ${context.currentStudent.acudiente}.`
        : 'No hay estudiante actual en este momento.';
    }
    if (p.includes('orden')) {
      const list = (context.routeList || []).slice(0, 12).map((s, i) => `${i + 1}. ${s.nombre} - ${s.barrio}`).join('\n');
      return list || 'No hay estudiantes activos en la ruta seleccionada.';
    }
    if (p.includes('alistando')) return improve(buildMessage('alistando', context.tone || 'cercano', context.data || {}), 'amable');
    if (p.includes('barrio')) return improve(buildMessage('ingresoBarrio', context.tone || 'cercano', context.data || {}), 'amable');
    if (p.includes('retraso')) return improve(buildMessage('retraso', 'formal', context.data || {}), 'formal');
    if (p.includes('mejor') || p.includes('redact') || p.includes('mensaje')) return improve(prompt, 'amable');
    return improve(prompt, 'amable');
  }

  return { buildMessage, improve, answer };
})();
