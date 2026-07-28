/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from "../types";

export const INITIAL_STATE: AppState = {
  users: [
    {
      id: "u1",
      nomeCompleto: "Carlos Eduardo Silva",
      email: "carlos@meuposto.com",
      senhaCriptografada: "carlos123",
      cpf: "123.456.789-00",
      cargo: "Master",
      cnpjPosto: "12.345.678/0001-99",
      telefone: "(11) 98765-4321",
      avatarIcon: "🛡️",
    },
    {
      id: "u2",
      nomeCompleto: "Mariana Costa Santos",
      email: "mariana@meuposto.com",
      senhaCriptografada: "mariana123",
      cpf: "987.654.321-11",
      cargo: "Gerente",
      cnpjPosto: "12.345.678/0001-99",
      telefone: "(11) 91234-5678",
      avatarIcon: "👩‍💼",
    },
    {
      id: "u3",
      nomeCompleto: "Marcos Souza Lima",
      email: "marcos@meuposto.com",
      senhaCriptografada: "marcos123",
      cpf: "111.222.333-44",
      cargo: "Frentista",
      cnpjPosto: "12.345.678/0001-99",
      telefone: "(11) 95555-4444",
      avatarIcon: "⛽",
    },
    {
      id: "u4",
      nomeCompleto: "Roberto Alves de Oliveira",
      email: "roberto@meuposto.com",
      senhaCriptografada: "roberto123",
      cpf: "222.333.444-55",
      cargo: "Frentista",
      cnpjPosto: "12.345.678/0001-99",
      telefone: "(11) 97777-8888",
      avatarIcon: "👨‍🔧",
    },
  ],
  tanks: [
    {
      id: "t1",
      identificador: "Tanque 01 - Gasolina Comum",
      combustivel: "Gasolina Comum",
      capacidadeMaxima: 15000,
      volumeAtual: 10500,
      pontoCriticoAlerta: 2500,
      observacoes: "Última limpeza interna realizada em março de 2026. Filtros em ótimo estado.",
    },
    {
      id: "t2",
      identificador: "Tanque 02 - Gasolina Aditivada",
      combustivel: "Gasolina Aditivada",
      capacidadeMaxima: 10000,
      volumeAtual: 4200,
      pontoCriticoAlerta: 2000,
      observacoes: "Manutenção preventiva agendada para 20/07/2026 para drenar condensação.",
    },
    {
      id: "t3",
      identificador: "Tanque 03 - Etanol Hidratado",
      combustivel: "Etanol",
      capacidadeMaxima: 15000,
      volumeAtual: 12000,
      pontoCriticoAlerta: 2500,
      observacoes: "Abastecimento recente feito com laudo 100% conforme portaria ANP.",
    },
    {
      id: "t4",
      identificador: "Tanque 04 - Diesel S10",
      combustivel: "Diesel S10",
      capacidadeMaxima: 20000,
      volumeAtual: 14500,
      pontoCriticoAlerta: 3000,
      observacoes: "Válvulas e sensores de telemetria sem nenhuma ocorrência.",
    },
    {
      id: "t5",
      identificador: "Tanque 05 - Diesel S500",
      combustivel: "Diesel S500",
      capacidadeMaxima: 10000,
      volumeAtual: 1500, // Trigger warning
      pontoCriticoAlerta: 2000,
      observacoes: "ATENÇÃO: Nível crítico de estoque. Solicitar pedido urgente à distribuidora.",
    },
  ],
  nozzles: [
    {
      id: "b1",
      numeroBico: "Bico 01 - GC",
      bombaAssociada: "Bomba Principal A",
      tanqueId: "t1",
      encerranteInicial: 124500,
      precoPorLitro: 5.89,
    },
    {
      id: "b2",
      numeroBico: "Bico 02 - GA",
      bombaAssociada: "Bomba Principal A",
      tanqueId: "t2",
      encerranteInicial: 89320,
      precoPorLitro: 6.09,
    },
    {
      id: "b3",
      numeroBico: "Bico 03 - ET",
      bombaAssociada: "Bomba Principal B",
      tanqueId: "t3",
      encerranteInicial: 215400,
      precoPorLitro: 3.99,
    },
    {
      id: "b4",
      numeroBico: "Bico 04 - DS10",
      bombaAssociada: "Bomba Principal B",
      tanqueId: "t4",
      encerranteInicial: 341200,
      precoPorLitro: 5.79,
    },
  ],
  shifts: [
    {
      id: "s1",
      data: "2026-07-12",
      turno: "Turno A (Manhã)",
      frentistaResponsavel: "Marcos Souza Lima",
      checklist: {
        limpezaPistas: true,
        usoEPIs: true,
        afericaoEquipamentosSeguranca: true,
        testeGerador: true,
      },
      status: "Fechado",
      dayOfWeek: "Dia 12",
      stationCnpj: "12.345.678/0001-99",
    },
    {
      id: "s2",
      data: "2026-07-13",
      turno: "Turno A (Manhã)",
      frentistaResponsavel: "Marcos Souza Lima",
      checklist: {
        limpezaPistas: true,
        usoEPIs: true,
        afericaoEquipamentosSeguranca: true,
        testeGerador: false,
      },
      status: "Em Andamento",
      dayOfWeek: "Dia 13",
      stationCnpj: "12.345.678/0001-99",
      occurrences: [
        {
          id: "occ_mock_1",
          tipo: "Atraso",
          descricao: "Atraso de 15 minutos por conta de trânsito intenso na via principal.",
          dataHora: "2026-07-13 06:15",
        }
      ]
    },
    {
      id: "s_evt_1",
      data: "2026-07-15",
      turno: "Evento Geral",
      frentistaResponsavel: "Evento Geral",
      checklist: { limpezaPistas: false, usoEPIs: false, afericaoEquipamentosSeguranca: false, testeGerador: false },
      status: "Planejado",
      dayOfWeek: "Dia 15",
      stationCnpj: "12.345.678/0001-99",
      events: [
        {
          id: "evt_mock_1",
          titulo: "Manutenção Preventiva Compressores",
          tipo: "Manutenção",
          descricao: "Troca de óleo e filtros dos compressores de ar da pista.",
          horario: "10:00",
        }
      ]
    },
    {
      id: "s_evt_2",
      data: "2026-07-18",
      turno: "Evento Geral",
      frentistaResponsavel: "Evento Geral",
      checklist: { limpezaPistas: false, usoEPIs: false, afericaoEquipamentosSeguranca: false, testeGerador: false },
      status: "Planejado",
      dayOfWeek: "Dia 18",
      stationCnpj: "12.345.678/0001-99",
      events: [
        {
          id: "evt_mock_2",
          titulo: "Reunião Alinhamento Semanal",
          tipo: "Reunião",
          descricao: "Reunião com toda a equipe para alinhamento de metas e segurança.",
          horario: "14:30",
        }
      ]
    }
  ],
  transactions: [
    // Historical Turn s1 completed transactions
    {
      id: "tx1",
      shiftId: "s1",
      tipo: "Receita",
      categoria: "Combustíveis",
      descricao: "Venda Gasolina Comum (120 litros via Bico 01)",
      valor: 706.8,
      formaPagamento: "PIX",
      data: "2026-07-12T09:15",
    },
    {
      id: "tx2",
      shiftId: "s1",
      tipo: "Receita",
      categoria: "Conveniência",
      descricao: "Vendas Loja de Conveniência Manhã",
      valor: 345.5,
      formaPagamento: "Cartão de Crédito",
      data: "2026-07-12T11:40",
    },
    {
      id: "tx3",
      shiftId: "s1",
      tipo: "Despesa",
      categoria: "Despesas Operacionais",
      descricao: "Compra de material de limpeza emergencial",
      valor: 85.0,
      formaPagamento: "Dinheiro",
      data: "2026-07-12T10:00",
    },
    {
      id: "tx4",
      shiftId: "s1",
      tipo: "Receita",
      categoria: "Serviços (Troca de Óleo / Ducha)",
      descricao: "Serviço Completo de Troca de Óleo SUV",
      valor: 280.0,
      formaPagamento: "Cartão de Débito",
      data: "2026-07-12T10:30",
    },
  ],
  nozzleClosings: [
    {
      id: "nc1",
      shiftId: "s1",
      nozzleId: "b1",
      encerranteFinal: 124620, // 120 Liters sold
      litrosVendidos: 120,
      valorVendidoCalculado: 706.8,
    },
    {
      id: "nc2",
      shiftId: "s1",
      nozzleId: "b2",
      encerranteFinal: 89370, // 50 Liters sold
      litrosVendidos: 50,
      valorVendidoCalculado: 304.5,
    },
  ],
  reconciliations: [
    {
      id: "r1",
      shiftId: "s1",
      frentistaId: "u3",
      frentistaNome: "Marcos Souza Lima",
      valorDeclaradoFisico: 1235.8, // GC (706.8) + GA (304.5) + Conveniência (345.5) + Serviços (280) - Despesas (85) = 1551.8. Let's say we only counted 1535.8 BRL in physical, or similar.
      valorCalculadoTeorico: 1251.8, // 706.8 + 304.5 + 345.5 + 280 - 85 - wait, wait. Let's make it easy:
      diferenca: -16.0, // short of 16 BRL!
      observacoes: "Diferença devido a troco incorreto em venda em dinheiro.",
      dataFechamento: "2026-07-12T12:15:00Z",
    },
  ],
  calibrations: [
    {
      id: "c1",
      data: "2026-07-11",
      nozzleId: "b1",
      volumeMedido: 19.98,
      desvioMl: -20, // -20ml
      conforme: true,
      operadorResponsavel: "Mariana Costa Santos",
    },
    {
      id: "c2",
      data: "2026-07-12",
      nozzleId: "b2",
      volumeMedido: 20.07,
      desvioMl: 70, // +70ml (Fail!)
      conforme: false,
      operadorResponsavel: "Mariana Costa Santos",
    },
  ],
  qualityAudits: [
    {
      id: "q1",
      data: "2026-07-12",
      combustivel: "Gasolina Comum",
      densidade: 0.742,
      temperatura: 23.5,
      teorEtanol: 27, // ANP standard limit
      aspectoVisual: "Límpido e Isento",
      presencaImpurezas: false,
      conforme: true,
      responsavelTecnico: "Carlos Eduardo Silva",
    },
    {
      id: "q2",
      data: "2026-07-13",
      combustivel: "Gasolina Aditivada",
      densidade: 0.745,
      temperatura: 24.0,
      teorEtanol: 33, // Rejeitado: excede o limite máximo de 30% (E27/E30) da Lei nº 14.993/2024
      aspectoVisual: "Límpido e Isento",
      presencaImpurezas: false,
      conforme: false,
      responsavelTecnico: "Carlos Eduardo Silva",
    },
    {
      id: "q3",
      data: "2026-07-14",
      combustivel: "Etanol",
      densidade: 0.809,
      temperatura: 20.0,
      teorEtanol: 93.3, // 93.3% M/M (Mass fraction)
      aspectoVisual: "Límpido e Isento",
      presencaImpurezas: false,
      conforme: true,
      responsavelTecnico: "Roberto Silveira",
    },
  ],
  lmc: [
    {
      id: "l1",
      date: "2026-07-01",
      fuelType: "Gasolina Comum",
      openingStock: 12500,
      deliveryVolume: 0,
      litersSold: 2450,
      physicalStock: 10042,
      stationCnpj: "12.345.678/0001-99"
    },
    {
      id: "l2",
      date: "2026-07-02",
      fuelType: "Gasolina Comum",
      openingStock: 10042,
      deliveryVolume: 10000,
      litersSold: 2600,
      physicalStock: 17447,
      stationCnpj: "12.345.678/0001-99"
    },
    {
      id: "l3",
      date: "2026-07-01",
      fuelType: "Diesel S10",
      openingStock: 18000,
      deliveryVolume: 0,
      litersSold: 3100,
      physicalStock: 14896,
      stationCnpj: "12.345.678/0001-99"
    }
  ],
  appointments: [
    {
      id: "a1",
      title: "Inspeção de Vendas do INMETRO",
      date: "2026-07-15",
      time: "09:00",
      description: "Aferição periódica de vazão de todos os bicos instalados.",
      stationCnpj: "12.345.678/0001-99"
    },
    {
      id: "a2",
      title: "Manutenção Preventiva Tanque 02",
      date: "2026-07-20",
      time: "14:00",
      description: "Limpeza interna e drenagem de condensação do tanque.",
      stationCnpj: "12.345.678/0001-99"
    }
  ],
  systemCredentials: [
    {
      id: "sc1",
      systemName: "Emissor NF-e SEFAZ",
      category: "Fiscal",
      login: "faturamento@meuposto.com",
      password: "sefazSecret2026",
      description: "Portal do Contribuinte SEFAZ",
      stationCnpj: "12.345.678/0001-99"
    },
    {
      id: "sc2",
      systemName: "Concentrador de Bombas (Company)",
      category: "Operacional",
      login: "admin_gerente",
      password: "bombaMasterPass",
      description: "IP local: 192.168.1.100",
      stationCnpj: "12.345.678/0001-99"
    }
  ],
  deliveries: [
    {
      id: "d1",
      date: "2026-07-12",
      invoiceNumber: "NF-e 87342",
      fuelType: "Gasolina Comum",
      volume: 10000,
      driverName: "Carlos Silveira",
      driverCnh: "123456789-0",
      truckPlate: "ABC-1234",
      conformityId: "q1",
      stationCnpj: "12.345.678/0001-99"
    }
  ],
  audits: [
    {
      id: "ad1",
      date: "2026-07-13",
      time: "09:30:00",
      actionType: "LOGIN",
      target: "Segurança",
      details: "Gerente Mariana Costa Santos efetuou login no sistema.",
      operator: "mariana@meuposto.com",
      complianceStatus: "Regular",
      stationCnpj: "12.345.678/0001-99"
    }
  ],
  shortages: [
    {
      id: "sh_1",
      shiftId: "2026-07-10_Turno A (Manhã)",
      data: "2026-07-10",
      valorTotalFalta: 45.00,
      tipo: "Falta",
      funcionariosEnvolvidos: ["Marcos Souza Lima"],
      rateioPorFuncionario: 45.00,
      status: "Pendente",
      observacoes: "Diferença não identificada no fechamento físico."
    },
    {
      id: "sh_2",
      shiftId: "2026-07-11_Turno B (Tarde)",
      data: "2026-07-11",
      valorTotalFalta: 12.50,
      tipo: "Sobra",
      funcionariosEnvolvidos: ["Marcos Souza Lima"],
      rateioPorFuncionario: 12.50,
      status: "Concluído",
      observacoes: "Sobra de caixa identificada após conferência de envelopes."
    }
  ],
  lubricantDeliveries: [],
  dailyBalances: [
    {
      id: "bal_1",
      data: "2026-07-10",
      vendaCombustivel: 15450.50,
      vendaLubrificantes: 840.00,
      outrasReceitas: 1200.00,
      totalDespesas: 2300.00,
      saldoFinal: 15190.50,
      metodosPagamento: {
        dinheiro: 4500.00,
        cartaoCredito: 6000.00,
        cartaoDebito: 3000.00,
        pix: 1500.00,
        prazo: 450.50
      },
      fechadoPor: "Mariana Costa Santos",
      stationCnpj: "12.345.678/0001-99"
    },
    {
      id: "bal_2",
      data: "2026-07-11",
      vendaCombustivel: 12100.20,
      vendaLubrificantes: 560.00,
      outrasReceitas: 950.00,
      totalDespesas: 1800.00,
      saldoFinal: 11810.20,
      metodosPagamento: {
        dinheiro: 3200.00,
        cartaoCredito: 5000.00,
        cartaoDebito: 2500.00,
        pix: 1000.00,
        prazo: 410.20
      },
      fechadoPor: "Mariana Costa Santos",
      stationCnpj: "12.345.678/0001-99"
    },
    {
      id: "bal_3",
      data: "2026-07-12",
      vendaCombustivel: 18900.00,
      vendaLubrificantes: 1200.00,
      outrasReceitas: 1500.00,
      totalDespesas: 3100.00,
      saldoFinal: 18500.00,
      metodosPagamento: {
        dinheiro: 5500.00,
        cartaoCredito: 7500.00,
        cartaoDebito: 3500.00,
        pix: 2000.00,
        prazo: 400.00
      },
      fechadoPor: "Mariana Costa Santos",
      stationCnpj: "12.345.678/0001-99"
    }
  ],
  dashboardPreferences: {
    visibleWidgets: {
      quickStats: true,
      fuelTanks: true,
      activeShift: true,
      qualityControl: true
    },
    dailyGoalLiters: 15000
  },
  supplyRequests: [
    {
      id: "req_1",
      dataHora: "2026-07-14 08:30:00",
      tipo: "Fardamento",
      nomePosto: "Posto Central Sol",
      cnpjPosto: "12.345.678/0001-99",
      quemSolicita: "Mariana Costa Santos",
      paraQuemSolicita: "Douglas Ferreira",
      relacionadoFuncionario: true,
      funcionarioNome: "Douglas Ferreira",
      tamanhoFarda: "G",
      numeracaoBota: "41",
      itemDescricao: "Camisa Polo Oficial e Calça Refletiva",
      quantidade: 2,
      observacoes: "Substituição por desgaste natural.",
      status: "Pendente"
    },
    {
      id: "req_2",
      dataHora: "2026-07-13 14:15:00",
      tipo: "Equipamento de Manutenção",
      nomePosto: "Posto Central Sol",
      cnpjPosto: "12.345.678/0001-99",
      quemSolicita: "Mariana Costa Santos",
      paraQuemSolicita: "Equipe de Pista",
      relacionadoFuncionario: false,
      itemDescricao: "Fita de Demarcação Amarela/Preta 50m e Cones Refletivos",
      quantidade: 4,
      observacoes: "Para sinalização de manutenção na pista 3.",
      status: "Aprovado"
    }
  ],
  timesheetEntries: [
    {
      id: "pt_1",
      userId: "u_2", // Assuming Mariana
      userName: "Mariana Costa Santos",
      data: "2026-07-14",
      entrada: "08:00",
      intervaloInicio: "12:00",
      intervaloFim: "13:00",
      saida: "17:00",
      horasTrabalhadas: "08:00",
      confirmado: true,
      dataHoraRegistro: "2026-07-14 17:05:00",
      assinaturaDigital: "ASS-MCSC-55412",
      status: "Confirmado"
    },
    {
      id: "pt_2",
      userId: "u_1", // Douglas
      userName: "Douglas Ferreira",
      data: "2026-07-14",
      entrada: "06:00",
      intervaloInicio: "10:00",
      intervaloFim: "11:00",
      saida: "14:00",
      horasTrabalhadas: "07:00",
      confirmado: true,
      dataHoraRegistro: "2026-07-14 14:10:00",
      assinaturaDigital: "ASS-DFER-88219",
      status: "Confirmado"
    },
    {
      id: "pt_3",
      userId: "u_3",
      userName: "Carlos Santos",
      data: "2026-07-14",
      entrada: "14:00",
      intervaloInicio: "18:00",
      intervaloFim: "19:00",
      saida: "22:00",
      horasTrabalhadas: "07:00",
      confirmado: false,
      dataHoraRegistro: "2026-07-14 22:05:00",
      status: "Pendente"
    }
  ],
  nomePosto: "Meu Posto - Gestão Inteligente",
  securePassword: "adm001"
};
