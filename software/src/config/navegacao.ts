import {
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileText,
  HelpCircle,
  History,
  Home,
  LayoutGrid,
  MessageCircle,
  Plug,
  Receipt,
  Settings2,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Menu lateral do painel. Para um módulo novo:
 * 1. acrescente o item aqui com status "em_construcao" (a página /app/<rota>
 *    passa a existir sozinha, com o aviso "em construção");
 * 2. quando o módulo ficar pronto, crie src/app/app/<rota>/page.tsx (ela tem
 *    prioridade sobre a página genérica) e troque o status para "pronto".
 */
export type StatusModulo = "pronto" | "em_construcao";

export type ItemNavegacao = {
  rota: string;
  rotulo: string;
  icone: LucideIcon;
  status: StatusModulo;
  /** O que o módulo vai fazer (mostrado na página "em construção"). */
  descricao?: string;
};

export type GrupoNavegacao = { titulo: string; itens: ItemNavegacao[] };

export const NAVEGACAO: GrupoNavegacao[] = [
  {
    titulo: "Visão geral",
    itens: [
      { rota: "/app", rotulo: "Carteira", icone: LayoutGrid, status: "pronto" },
      { rota: "/app/hoje", rotulo: "Hoje", icone: Home, status: "pronto" },
      { rota: "/app/valor", rotulo: "Valor", icone: BarChart3, status: "pronto" },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { rota: "/app/chamados", rotulo: "Chamados", icone: Wrench, status: "pronto" },
      { rota: "/app/rotinas", rotulo: "Rotinas", icone: ClipboardCheck, status: "pronto" },
      { rota: "/app/vencimentos", rotulo: "Vencimentos", icone: CalendarClock, status: "pronto" },
      { rota: "/app/duvidas", rotulo: "Dúvidas", icone: HelpCircle, status: "pronto" },
      { rota: "/app/despesas", rotulo: "Despesas", icone: Receipt, status: "pronto" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { rota: "/app/condominios", rotulo: "Condomínios", icone: Building2, status: "pronto" },
      { rota: "/app/unidades", rotulo: "Unidades e moradores", icone: Users, status: "pronto" },
      { rota: "/app/equipe", rotulo: "Equipe", icone: UserCog, status: "pronto" },
      { rota: "/app/prestadores", rotulo: "Prestadores", icone: Truck, status: "pronto" },
      { rota: "/app/documentos", rotulo: "Documentos", icone: FileText, status: "pronto" },
    ],
  },
  {
    titulo: "Configuração",
    itens: [
      { rota: "/app/regras", rotulo: "Regras", icone: Settings2, status: "pronto" },
      { rota: "/app/telegram", rotulo: "Telegram", icone: MessageCircle, status: "pronto" },
      { rota: "/app/integracoes", rotulo: "Integrações", icone: Plug, status: "pronto" },
      { rota: "/app/auditoria", rotulo: "Auditoria", icone: History, status: "pronto" },
      { rota: "/app/lgpd", rotulo: "LGPD", icone: ShieldCheck, status: "pronto" },
    ],
  },
];

export function itemPorRota(rota: string): ItemNavegacao | undefined {
  for (const g of NAVEGACAO) for (const i of g.itens) if (i.rota === rota) return i;
  return undefined;
}
