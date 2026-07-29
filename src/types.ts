/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "Master" | "Gerente" | "Supervisor" | "Frentista";

export interface User {
  id: string;
  nomeCompleto: string;
  email: string;
  senhaCriptografada: string; // Stored as plain string for demo simulation
  cpf: string;
  cargo: UserRole;
  cnpjPosto: string;
  telefone: string;
  avatarUrl?: string;
  avatarIcon?: string;
  isGoogleLinked?: boolean;
  googleEmail?: string;
  googleDisplayName?: string;
}

export type FuelType = "Gasolina Comum" | "Gasolina Aditivada" | "Gasolina Premium" | "Etanol" | "Diesel S10" | "Diesel S500";

export interface FuelTank {
  id: string;
  identificador: string; // e.g., "Tanque 01"
  combustivel: FuelType;
  capacidadeMaxima: number; // in liters
  volumeAtual: number; // in liters
  pontoCriticoAlerta: number; // min safe level in liters
  cor?: string; // Hex color or Tailwind class for tank identification
  observacoes?: string; // observations / notes per tank
}

export interface Nozzle {
  id: string;
  numeroBico: string; // e.g., "Bico 01"
  bombaAssociada: string; // e.g., "Bomba A"
  tanqueId: string; // ID of the feeder fuel tank
  encerranteInicial: number; // in liters (hodômetro mecânico inicial)
  precoPorLitro: number; // e.g., 5.89
  desconto?: number; // Optional discount in R$ per liter
  status?: "Ativo" | "Livre" | "Manutencao" | "Bloqueado" | string;
}

export type ShiftName = "Turno A (Manhã)" | "Turno B (Tarde)" | "Turno C (Noite)" | string;

export interface ShiftChecklist {
  limpezaPistas: boolean;
  usoEPIs: boolean;
  afericaoEquipamentosSeguranca: boolean;
  testeGerador: boolean;
}

export interface ShiftOccurrence {
  id: string;
  tipo: "Atraso" | "Falta" | "Atestado" | "Dobra" | "Problema na Pista" | "Outro";
  descricao: string;
  dataHora: string; // YYYY-MM-DD HH:MM
  imagem?: string; // Attached image (Base64 or URL)
}

export interface ShiftEvent {
  id: string;
  titulo: string;
  tipo: "Treinamento" | "Reunião" | "Manutenção" | "Auditoria" | "Outro";
  descricao: string;
  horario: string; // HH:MM
}

export type ShiftStatusType = "Trabalhando" | "Folga" | "Horista" | "Férias" | "Afastado" | "Licença";

export interface EscalaPattern {
  id: string;
  funcionario: string;
  tipoEscala: "6x1" | "12x36" | "Fixo" | "Rodízio 3 Turnos" | "Personalizado";
  sequenciaTurnos: string[];
  diasTurno: number;
  diasFolga: number;
  historicoEscalasCount: number;
  ultimaAtualizacao: string; // YYYY-MM-DD
  confiancaIA: number; // e.g. 98, 94, 85
  stationCnpj?: string;
  observacao?: string;
}

export interface ShiftSchedule {
  id: string;
  data: string; // YYYY-MM-DD
  turno: ShiftName;
  frentistaResponsavel: string; // Nome do frentista
  checklist: ShiftChecklist;
  status: "Planejado" | "Em Andamento" | "Fechado";
  statusEscala?: ShiftStatusType;
  stationCnpj?: string;
  dayOfWeek?: string;
  occurrences?: ShiftOccurrence[];
  events?: ShiftEvent[];
}

export type TransactionType = "Receita" | "Despesa";
export type TransactionCategory = "Combustíveis" | "Conveniência" | "Serviços (Troca de Óleo / Ducha)" | "Despesas Operacionais";
export type PaymentMethod = "Dinheiro" | "Cartão de Crédito" | "Cartão de Débito" | "PIX" | "Prazo";

export interface CashTransaction {
  id: string;
  shiftId?: string; // Associated shift if any
  tipo: TransactionType;
  categoria: TransactionCategory;
  descricao: string;
  valor: number;
  formaPagamento?: PaymentMethod;
  data: string; // YYYY-MM-DD THH:mm
}

// Records closing readings for nozzles at the end of a shift
export interface NozzleClosing {
  id: string;
  shiftId: string;
  nozzleId: string;
  encerranteFinal: number; // in liters
  litrosVendidos: number; // calculated: encerranteFinal - encerranteInicial
  valorVendidoCalculado: number; // calculated: litrosVendidos * precoPorLitro
  valorTotalVendidos?: number; // alias for total sales
  assinaturaDigital?: string; // Data URL string of captured mouse/touch signature
  frentistaResponsavel?: string;
}

// Turn audit (fechamento de caixa/turno)
export interface ShiftReconciliation {
  id: string;
  shiftId: string;
  frentistaId: string;
  frentistaNome: string;
  valorDeclaradoFisico: number; // Declared cash collected by frentista
  valorCalculadoTeorico: number; // Theoretical total calculated from NozzleClosings + any additional receipts
  diferenca: number; // Declared - Theoretical (negative indicates cashier shortage / quebra de caixa)
  observacoes?: string;
  dataFechamento: string;
}

export interface ShiftShortage {
  id: string;
  shiftId: string;
  data: string;
  valorTotalFalta: number; // Valor total da diferença
  tipo: "Falta" | "Sobra";
  funcionariosEnvolvidos: string[]; // Lista de nomes de funcionários no turno
  rateioPorFuncionario: number; // valorTotalFalta / funcionariosEnvolvidos.length
  status: "Pendente" | "Pago" | "Descontado" | "Concluído";
  observacoes?: string;
}

// Aferição de bicos (testes físicos de vazão de 20 litros)
export interface NozzleCalibration {
  id: string;
  data: string; // YYYY-MM-DD
  nozzleId: string;
  volumeMedido: number; // should be close to the selected gallon volume (e.g. 20L)
  desvioMl: number; // allowed deviation is from -100 to +100 mL
  conforme: boolean; // desvioMl between -100 and +100 mL
  operadorResponsavel: string;
  valorReais?: number; // valor da aferição em R$ (precoPorLitro * volumeMedido)
}

// Controle de qualidade ANP diário
export interface ANPQualityAudit {
  id: string;
  data: string; // YYYY-MM-DD
  combustivel: FuelType;
  densidade: number; // g/cm³ (e.g., 0.720 to 0.775)
  temperatura: number; // °C (e.g., 20 to 35)
  densidadeCorrigida?: number; // g/cm³ corrected to 20°C according to ANP 2026
  teorEtanol: number; // % (ANP limit of 27% for Gasoline, ignore or N/A for diesel/pure ethanol)
  aspectoVisual: "Límpido e Isento" | "Turvo" | "Com Impurezas";
  presencaImpurezas: boolean;
  conforme: boolean; // calculations/checks based on fuel specifications
  responsavelTecnico: string;
  // Vínculo com Nota Fiscal (NF-e) e Distribuidora
  numeroNotaFiscal?: string; // e.g. "NF-e 10542"
  fornecedorNota?: string; // e.g. "Vibra Energia / Petrobras"
  chaveAcessoNfe?: string; // Chave de acesso de 44 dígitos da NF-e
  numeroLaudoFornecedor?: string; // Número do laudo fornecido pela base/refinaria
  deliveryId?: string; // ID da entrega registrada no sistema
}

export interface SyncConfig {
  apiUrl: string;
  token: string;
  autoSync: boolean;
  scheduledBackupEnabled?: boolean;
  backupFrequency?: "daily" | "12h" | "weekly" | "shift_end";
  backupDestination?: "download" | "cloud" | "both";
  lastBackupDate?: string;
  lastCloudSyncDate?: string;
  autoDownloadLocalJson?: boolean;
  googleDriveBackupEnabled?: boolean;
  googleDriveFolderName?: string;
  googleDriveFolderId?: string;
  googleDriveTokens?: {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    expiry_date?: number;
  } | null;
  lastGoogleDriveBackupDate?: string;
  lastGoogleDriveFileLink?: string;
}

// Entire app database state that gets synchronized
export interface LmcRecord {
  id: string;
  date: string; // YYYY-MM-DD
  fuelType: string;
  openingStock: number;
  deliveryVolume: number;
  litersSold: number;
  physicalStock: number;
  stationCnpj?: string;
  gainLossLiters?: number;
  observations?: string;
  bookStock?: number;
}

export interface Appointment {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  description?: string;
  stationCnpj: string;
}

export interface SystemCredential {
  id: string;
  systemName: string;
  category: string;
  login: string;
  password: string; // Password stored as string
  description?: string;
  stationCnpj: string;
}

export interface FuelDelivery {
  id: string;
  date?: string;
  invoiceNumber?: string;
  fuelType?: string;
  volume?: number;
  driverName?: string;
  driverCnh?: string;
  truckPlate?: string;
  conformityId?: string | null;
  stationCnpj: string;
  data?: string;
  nfe?: string;
  combustivel?: string;
  volumeRecebido?: number;
  placaCaminhao?: string;
  motorista?: string;
  densidadeMedida?: number;
  temperaturaMedida?: number;
  densidadeCorrigida?: number;
  conforme?: boolean;
  // Vínculos com Laudo de Qualidade ANP e Distribuidora
  qualityAuditId?: string; // ID do Laudo ANP gerado pelo posto
  numeroLaudoFornecedor?: string; // Número do Laudo/Certificado de Análise do fornecedor/refinaria
  fornecedor?: string; // Nome da distribuidora (Vibra, Ipiranga, Raízen, Shell, etc.)
  chaveAcessoNfe?: string; // Chave de acesso de 44 dígitos
}

export interface LubricantProduct {
  id: string;
  nome: string;
  quantidade: number;
  unidade: "Frasco" | "Balde" | "Tambor" | "Caixa";
  conferido: boolean;
}

export interface LubricantDelivery {
  id: string;
  dataRecebimento: string;
  numeroNota: string;
  fornecedor: string;
  valorTotal: number;
  produtos: LubricantProduct[];
  statusConferencia: "Pendente" | "Parcial" | "Concluída";
  observacoes?: string;
  stationCnpj: string;
}

export interface DailyBalance {
  id: string;
  data: string; // YYYY-MM-DD
  vendaCombustivel: number;
  vendaLubrificantes: number;
  outrasReceitas: number;
  totalDespesas: number;
  saldoFinal: number;
  metodosPagamento: {
    dinheiro: number;
    cartaoCredito: number;
    cartaoDebito: number;
    pix: number;
    prazo: number;
  };
  fechadoPor: string;
  stationCnpj: string;
  observacoes?: string;
}

export interface ActivityLog {
  id: string;
  date: string;
  time: string;
  actionType: string;
  target: string;
  details: string;
  operator: string;
  complianceStatus: string;
  stationCnpj: string;
}

export interface DashboardPreferences {
  visibleWidgets: {
    quickStats: boolean;
    fuelTanks: boolean;
    activeShift: boolean;
    qualityControl: boolean;
  };
  cardOrder?: string[];
  dailyGoalLiters: number;
}

export interface SupplyRequest {
  id: string;
  dataHora: string; // YYYY-MM-DD HH:MM:SS
  tipo: "Fardamento" | "Bota" | "Material de Escritório" | "Equipamento de Manutenção";
  nomePosto: string;
  cnpjPosto: string;
  quemSolicita: string;
  paraQuemSolicita: string;
  relacionadoFuncionario: boolean;
  funcionarioNome?: string;
  tamanhoFarda?: string;
  numeracaoBota?: string;
  itemDescricao: string;
  quantidade: number;
  observacoes?: string;
  status: "Pendente" | "Aprovado" | "Entregue" | "Cancelado";
}

export interface TimesheetEntry {
  id: string;
  userId: string;
  userName: string;
  data: string; // YYYY-MM-DD
  entrada: string; // HH:MM
  intervaloInicio?: string; // HH:MM
  intervaloFim?: string; // HH:MM
  saida?: string; // HH:MM
  horasTrabalhadas?: string; // e.g. "08:30"
  confirmado: boolean; // confirmed by user
  dataHoraRegistro: string; // YYYY-MM-DD HH:MM:SS
  assinaturaDigital?: string; // digital sign token
  status: "Pendente" | "Confirmado" | "Rejeitado";
  observacoes?: string;
}

export interface AppState {
  users: User[];
  tanks: FuelTank[];
  nozzles: Nozzle[];
  shifts: ShiftSchedule[];
  transactions: CashTransaction[];
  nozzleClosings: NozzleClosing[];
  reconciliations: ShiftReconciliation[];
  calibrations: NozzleCalibration[];
  qualityAudits: ANPQualityAudit[];
  lmc: LmcRecord[];
  appointments: Appointment[];
  systemCredentials: SystemCredential[];
  deliveries: FuelDelivery[];
  audits: ActivityLog[];
  shortages: ShiftShortage[];
  lubricantDeliveries: LubricantDelivery[];
  dailyBalances: DailyBalance[];
  dashboardPreferences?: DashboardPreferences;
  supplyRequests?: SupplyRequest[];
  timesheetEntries?: TimesheetEntry[];
  schedulePatterns?: EscalaPattern[];
  nomePosto?: string;
  securePassword?: string;
  reportHeaderLogo?: string; // Base64 data URL
  reportHeaderCompanyName?: string;
  reportHeaderCnpj?: string;
  reportHeaderAddress?: string;
  reportSignatureBase64?: string; // Base64 data URL
  reportSignatureName?: string;
  reportSignatureRole?: string;
  reportSignatureEnabled?: boolean;
  updatedAt?: number;
}

