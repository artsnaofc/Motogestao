import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  ShieldAlert, 
  Trash2, 
  ShieldCheck,
  UserX,
  Mail,
  UserPlus
} from 'lucide-react';
import { UserSettings } from '../../types';

interface UserListProps {
  users: UserSettings[];
  onToggleAdmin: (userId: string, currentStatus: boolean) => void;
  onDeleteUser?: (userId: string) => void;
  loadingId?: string;
  onCreateClick?: () => void;
}

export function UserList({ users, onToggleAdmin, onDeleteUser, loadingId, onCreateClick }: UserListProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Membros da Plataforma
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Gerencie os acessos, permissões e dados dos usuários ativos.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="hidden sm:flex text-xs font-mono bg-muted px-3 py-1.5 rounded-lg text-muted-foreground font-bold border border-border/40 shadow-sm">
            {users.length} Registros
          </span>
          <Button 
            onClick={onCreateClick} 
            className="w-full sm:w-auto rounded-xl h-10 font-bold shadow-sm"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.map((user) => (
          <Card key={user.user_id} className="border-border/40 bg-background/50 hover:bg-muted/10 hover:border-primary/20 transition-all overflow-hidden shadow-sm hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm ${user.is_admin ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-border/50 text-muted-foreground'}`}>
                    {user.is_admin ? <ShieldCheck className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm text-foreground truncate">
                        {user.full_name || 'Usuário Sem Nome'}
                      </p>
                      {user.is_admin && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black tracking-wider uppercase border border-primary/20">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate font-medium">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">Sem e-mail vinculado</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-5 pt-4 border-t border-border/30 grid grid-cols-2 gap-3">
                <div className="bg-muted/30 p-2.5 rounded-xl border border-border/40">
                  <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider mb-1">Saldo Atual</p>
                  <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    R$ {user.initial_balance?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-muted/30 p-2.5 rounded-xl border border-border/40">
                  <p className="text-[9px] text-muted-foreground font-black uppercase tracking-wider mb-1">Status</p>
                  <p className="text-xs font-bold text-foreground">
                    Ativo
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 rounded-lg text-xs font-bold transition-colors ${user.is_admin ? 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/50' : 'border-border/50 hover:bg-muted'}`}
                  onClick={() => onToggleAdmin(user.user_id, !!user.is_admin)}
                  disabled={loadingId === user.user_id}
                >
                  {user.is_admin ? (
                    <><ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Remover Admin</>
                  ) : (
                    <><ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Tornar Admin</>
                  )}
                </Button>
                
                {onDeleteUser && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg border-border/50 text-destructive hover:bg-destructive/10 hover:border-destructive/20"
                    onClick={() => onDeleteUser(user.user_id)}
                    disabled={loadingId === user.user_id}
                    title="Excluir Usuário"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {users.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-border/50 rounded-[2rem] bg-muted/10">
            <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-sm">
              <UserX className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h4 className="text-base font-bold text-foreground mb-1">Nenhum registro encontrado</h4>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Não foi possível localizar outros usuários na base de dados neste momento.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
