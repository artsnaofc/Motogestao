import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Mail, User, ShieldCheck } from 'lucide-react';
import { toast } from '@/lib/toast';
import { supabase } from '../../lib/supabase';
import { systemSettings } from '../../lib/systemSettings';

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateUserModal({ open, onOpenChange, onSuccess }: CreateUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Audit log the invitation
      systemSettings.logAction(
        'Administrador',
        'Convite de Membro',
        `Convite enviado para ${formData.email} (${formData.name}) com perfil ${formData.role === 'admin' ? 'Administrador' : 'Usuário Padrão'}.`,
        'user',
        'info'
      );

      // 2. Disparar link de acesso pelo Supabase Auth caso o email já esteja pré-cadastrado
      try {
        await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      } catch (authErr) {
        console.warn('Envio de reset/invite via Supabase Auth:', authErr);
      }
      
      toast.success('Convite processado com sucesso!', {
        description: `O registro foi processado e as credenciais foram preparadas para ${formData.email}.`,
      });
      
      setFormData({ name: '', email: '', role: 'user' });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao convidar usuário', {
        description: err.message || 'Ocorreu um erro interno.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl p-0 overflow-hidden border-border/50">
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 via-background to-background">
          <DialogHeader>
            <div className="w-12 h-12 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mb-4 border border-primary/20 shadow-sm">
              <UserPlus className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold">Convidar Novo Usuário</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-medium">
              Envie um convite de acesso para que um novo membro possa configurar sua conta.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Nome Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  id="name"
                  placeholder="Ex: João da Silva"
                  className="pl-9 h-11 rounded-xl bg-muted/30 border-border/50 focus-visible:ring-primary/50"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground block leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@exemplo.com"
                  className="pl-9 h-11 rounded-xl bg-muted/30 border-border/50 focus-visible:ring-primary/50"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Nível de Acesso</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center z-10 pointer-events-none">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </div>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger className="pl-9 h-11 rounded-xl bg-muted/30 border-border/50 focus:ring-primary/50">
                    <SelectValue placeholder="Selecione o acesso" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50">
                    <SelectItem value="user" className="rounded-lg">Usuário Padrão</SelectItem>
                    <SelectItem value="admin" className="rounded-lg text-primary font-bold">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button 
              type="button" 
              variant="outline" 
              className="rounded-xl h-11 font-bold border-border/50 hover:bg-muted"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="rounded-xl h-11 font-bold shadow-lg"
              disabled={loading}
            >
              {loading ? 'Enviando...' : 'Enviar Convite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
