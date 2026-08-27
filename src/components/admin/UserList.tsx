import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  ShieldAlert, 
  Trash2, 
  ShieldCheck,
  UserX,
  Mail,
  UserPlus,
  Search,
  SlidersHorizontal,
  Download,
  Eye,
  Edit3,
  LayoutGrid,
  List,
  Target,
  Fuel,
  DollarSign,
  Copy,
  Check,
  TrendingUp,
  Briefcase
} from 'lucide-react';
import { UserSettings } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { toast } from 'sonner';

interface UserListProps {
  users: UserSettings[];
  onToggleAdmin: (userId: string, currentStatus: boolean) => void;
  onDeleteUser?: (userId: string) => void;
  onEditUser?: (user: UserSettings) => void;
  onViewDetails?: (user: UserSettings) => void;
  loadingId?: string;
  onCreateClick?: () => void;
}

type FilterRole = 'all' | 'admin' | 'user' | 'with_balance' | 'with_goals';
type SortOption = 'newest' | 'name_asc' | 'name_desc' | 'balance_desc' | 'goal_desc';

export function UserList({ 
  users, 
  onToggleAdmin, 
  onDeleteUser, 
  onEditUser,
  onViewDetails,
  loadingId, 
  onCreateClick 
}: UserListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('ID copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Stats calculation
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.is_admin).length;
  const standardUsersCount = totalUsers - adminCount;
  const totalInitialBalance = users.reduce((sum, u) => sum + (u.initial_balance || 0), 0);

  // Filter & sort logic
  const filteredUsers = useMemo(() => {
    return users
      .filter(user => {
        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesName = user.full_name?.toLowerCase().includes(term);
          const matchesId = user.user_id.toLowerCase().includes(term);
          if (!matchesName && !matchesId) return false;
        }

        // Role filter
        if (roleFilter === 'admin') return !!user.is_admin;
        if (roleFilter === 'user') return !user.is_admin;
        if (roleFilter === 'with_balance') return (user.initial_balance || 0) > 0;
        if (roleFilter === 'with_goals') return (user.weekly_goal || 0) > 0;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name_asc') {
          return (a.full_name || '').localeCompare(b.full_name || '');
        }
        if (sortBy === 'name_desc') {
          return (b.full_name || '').localeCompare(a.full_name || '');
        }
        if (sortBy === 'balance_desc') {
          return (b.initial_balance || 0) - (a.initial_balance || 0);
        }
        if (sortBy === 'goal_desc') {
          return (b.weekly_goal || 0) - (a.weekly_goal || 0);
        }
        return 0; // Default order as returned
      });
  }, [users, searchTerm, roleFilter, sortBy]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      toast.error('Nenhum usuário para exportar');
      return;
    }

    const headers = [
      'user_id',
      'full_name',
      'is_admin',
      'initial_balance',
      'weekly_goal',
      'weekly_net_goal',
      'vehicle_km_per_liter',
      'fuel_price',
      'default_driver_labor',
      'quote_provider',
    ];

    const rows = filteredUsers.map(u => [
      `"${u.user_id}"`,
      `"${u.full_name || ''}"`,
      u.is_admin ? 'true' : 'false',
      u.initial_balance ?? 0,
      u.weekly_goal ?? 0,
      u.weekly_net_goal ?? 0,
      u.vehicle_km_per_liter ?? 0,
      u.fuel_price ?? 0,
      u.default_driver_labor ?? 0,
      `"${u.quote_provider || 'auto'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `membros_financas_pro_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Relatório CSV de membros exportado!');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Gerenciamento de Membros
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visualize, configure privilégios, metas, veículos e parâmetros de cada usuário da plataforma.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl h-10 font-bold text-xs border-border/60 hover:bg-muted gap-1.5 cursor-pointer shadow-xs"
            title="Exportar dados para planilha CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>

          <Button 
            onClick={onCreateClick} 
            className="rounded-xl h-10 font-bold text-xs shadow-sm gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Convidar Membro
          </Button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Total de Membros
          </span>
          <p className="text-xl font-black text-foreground mt-0.5">{totalUsers}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20">
          <span className="text-[10px] font-black uppercase tracking-wider text-primary block">
            Administradores
          </span>
          <p className="text-xl font-black text-primary mt-0.5">{adminCount}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
            Usuários Padrão
          </span>
          <p className="text-xl font-black text-foreground mt-0.5">{standardUsersCount}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            Soma Saldos Iniciais
          </span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            {formatCurrency(totalInitialBalance)}
          </p>
        </div>
      </div>

      {/* Filter, Search & View Mode Controls */}
      <div className="space-y-3 p-4 rounded-2xl bg-muted/20 border border-border/50">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nome ou ID do usuário..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-background border-border/60 text-xs font-medium focus-visible:ring-primary/40"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-bold cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Sort & View Mode */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="h-10 px-3 rounded-xl bg-background border border-border/60 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="newest">Mais Recentes</option>
              <option value="name_asc">Nome (A - Z)</option>
              <option value="name_desc">Nome (Z - A)</option>
              <option value="balance_desc">Maior Saldo Inicial</option>
              <option value="goal_desc">Maior Meta Semanal</option>
            </select>

            <div className="flex items-center bg-background p-1 rounded-xl border border-border/60">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Visualização em Grade"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'table' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Visualização em Tabela"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex overflow-x-auto hide-scrollbar gap-1.5 pt-1">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-background hover:bg-muted text-muted-foreground border border-border/60'
            }`}
          >
            Todos ({totalUsers})
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              roleFilter === 'admin'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-background hover:bg-muted text-muted-foreground border border-border/60'
            }`}
          >
            Admins ({adminCount})
          </button>
          <button
            onClick={() => setRoleFilter('user')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              roleFilter === 'user'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-background hover:bg-muted text-muted-foreground border border-border/60'
            }`}
          >
            Usuários Padrão ({standardUsersCount})
          </button>
          <button
            onClick={() => setRoleFilter('with_balance')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              roleFilter === 'with_balance'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-background hover:bg-muted text-muted-foreground border border-border/60'
            }`}
          >
            Com Saldo
          </button>
          <button
            onClick={() => setRoleFilter('with_goals')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              roleFilter === 'with_goals'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-background hover:bg-muted text-muted-foreground border border-border/60'
            }`}
          >
            Com Metas
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredUsers.map((user) => (
            <Card 
              key={user.user_id} 
              className="border-border/50 bg-background/60 hover:bg-muted/10 hover:border-primary/30 transition-all overflow-hidden shadow-sm hover:shadow-md flex flex-col justify-between"
            >
              <CardContent className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  {/* Card Header: Avatar & Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs font-black text-base ${
                        user.is_admin 
                          ? 'bg-primary/15 border-primary/30 text-primary' 
                          : 'bg-muted/70 border-border/60 text-muted-foreground'
                      }`}>
                        {user.full_name ? user.full_name.substring(0, 2).toUpperCase() : <Users className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold text-sm text-foreground truncate">
                            {user.full_name || 'Usuário Sem Nome'}
                          </p>
                        </div>
                        {user.is_admin ? (
                          <span className="inline-block px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black tracking-wider uppercase border border-primary/20">
                            Administrador
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[9px] font-bold tracking-wider uppercase border border-border/40">
                            Membro Padrão
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopy(user.user_id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
                      title="Copiar ID do usuário"
                    >
                      {copiedId === user.user_id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Financial & Operational Metric Badges */}
                  <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/30 p-2.5 rounded-xl border border-border/40">
                      <span className="text-[9px] text-muted-foreground font-black uppercase tracking-wider block">Saldo Inicial</span>
                      <p className="font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {formatCurrency(user.initial_balance || 0)}
                      </p>
                    </div>

                    <div className="bg-muted/30 p-2.5 rounded-xl border border-border/40">
                      <span className="text-[9px] text-muted-foreground font-black uppercase tracking-wider block">Meta Semanal</span>
                      <p className="font-mono font-bold text-foreground mt-0.5">
                        {user.weekly_goal ? formatCurrency(user.weekly_goal) : '—'}
                      </p>
                    </div>

                    <div className="bg-muted/30 p-2 rounded-xl border border-border/40 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1 font-medium">
                        <Fuel className="w-3 h-3 text-amber-500" /> Gasolina:
                      </span>
                      <span className="font-bold font-mono text-foreground">
                        {user.fuel_price ? `R$ ${user.fuel_price.toFixed(2)}` : 'R$ 5,89'}
                      </span>
                    </div>

                    <div className="bg-muted/30 p-2 rounded-xl border border-border/40 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1 font-medium">
                        <TrendingUp className="w-3 h-3 text-indigo-500" /> Cotação:
                      </span>
                      <span className="font-bold font-mono text-foreground uppercase text-[10px]">
                        {user.quote_provider || 'auto'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {onViewDetails && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 rounded-lg text-xs font-bold border-border/60 hover:bg-muted gap-1 cursor-pointer"
                        onClick={() => onViewDetails(user)}
                        title="Ver detalhes completos"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Detalhes
                      </Button>
                    )}
                    {onEditUser && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 rounded-lg text-xs font-bold border-border/60 hover:bg-muted gap-1 cursor-pointer"
                        onClick={() => onEditUser(user)}
                        title="Editar parâmetros"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`h-8 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        user.is_admin 
                          ? 'border-amber-500/30 text-amber-600 hover:bg-amber-500/10' 
                          : 'border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => onToggleAdmin(user.user_id, !!user.is_admin)}
                      disabled={loadingId === user.user_id}
                      title={user.is_admin ? 'Remover privilégio de admin' : 'Tornar administrador'}
                    >
                      {user.is_admin ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                      )}
                    </Button>

                    {onDeleteUser && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg border-border/60 text-destructive hover:bg-destructive/10 hover:border-destructive/30 cursor-pointer"
                        onClick={() => onDeleteUser(user.user_id)}
                        disabled={loadingId === user.user_id}
                        title="Excluir Usuário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="rounded-2xl border border-border/60 bg-background/60 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase text-[10px] font-black">
                <tr>
                  <th className="p-3.5">Membro</th>
                  <th className="p-3.5">Função</th>
                  <th className="p-3.5">Saldo Inicial</th>
                  <th className="p-3.5">Meta Semanal</th>
                  <th className="p-3.5">Consumo & Combustível</th>
                  <th className="p-3.5">Cotações</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {filteredUsers.map((user) => (
                  <tr key={user.user_id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border font-bold text-xs ${
                          user.is_admin ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-muted border-border/60 text-muted-foreground'
                        }`}>
                          {user.full_name ? user.full_name.substring(0, 2).toUpperCase() : <Users className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{user.full_name || 'Sem nome'}</p>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {user.user_id.substring(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5">
                      {user.is_admin ? (
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider border border-primary/20">
                          Admin
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-bold uppercase border border-border/40">
                          Membro
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(user.initial_balance || 0)}
                    </td>

                    <td className="p-3.5 font-mono font-bold text-foreground">
                      {user.weekly_goal ? formatCurrency(user.weekly_goal) : '—'}
                    </td>

                    <td className="p-3.5 text-muted-foreground font-mono">
                      {user.vehicle_km_per_liter || 35} km/L • R$ {(user.fuel_price || 5.89).toFixed(2)}/L
                    </td>

                    <td className="p-3.5 font-mono uppercase text-[10px] font-bold text-foreground">
                      {user.quote_provider || 'auto'}
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onViewDetails && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => onViewDetails(user)}
                            title="Ver detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {onEditUser && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => onEditUser(user)}
                            title="Editar parâmetros"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary cursor-pointer"
                          onClick={() => onToggleAdmin(user.user_id, !!user.is_admin)}
                          title={user.is_admin ? 'Remover Admin' : 'Tornar Admin'}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </Button>
                        {onDeleteUser && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer"
                            onClick={() => onDeleteUser(user.user_id)}
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <div className="py-16 text-center border-2 border-dashed border-border/50 rounded-[2rem] bg-muted/10">
          <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-sm">
            <UserX className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h4 className="text-base font-bold text-foreground mb-1">Nenhum membro encontrado</h4>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {searchTerm 
              ? `Nenhum resultado corresponde aos termos de busca "${searchTerm}".`
              : 'Não há registros cadastrados para os filtros selecionados.'}
          </p>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="mt-4 rounded-xl font-bold text-xs"
            >
              Limpar Busca
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
