import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  Building, 
  FileText, 
  Trash2, 
  Edit, 
  PlusCircle,
  MessageSquare,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { FreightClient, FreightQuote } from '../../types/freight';
import { freightStorage } from '../../lib/freightStorage';
import { maskPhone, maskCpfCnpj } from '../../lib/brazilianFormatters';

interface FreightClientsManagerProps {
  userId?: string;
  onSelectClientForQuote?: (client: FreightClient) => void;
  quotes?: FreightQuote[];
}

export function FreightClientsManager({
  userId = 'default',
  onSelectClientForQuote,
  quotes = [],
}: FreightClientsManagerProps) {
  const [clients, setClients] = useState<FreightClient[]>(() => freightStorage.getClients(userId));
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<FreightClient | null>(null);
  const [clientToDelete, setClientToDelete] = useState<FreightClient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');

  const refreshClients = () => {
    setClients(freightStorage.getClients(userId));
  };

  React.useEffect(() => {
    refreshClients();

    freightStorage.syncClientsFromDatabase(userId).then(loadedClients => {
      if (loadedClients && loadedClients.length > 0) {
        setClients(loadedClients);
      } else {
        refreshClients();
      }
    });

    const handleClientsUpdated = () => {
      refreshClients();
    };

    window.addEventListener('freight_clients_updated', handleClientsUpdated);
    return () => {
      window.removeEventListener('freight_clients_updated', handleClientsUpdated);
    };
  }, [userId, quotes]);

  const handleOpenAddModal = (clientToEdit?: FreightClient) => {
    if (clientToEdit) {
      setEditingClient(clientToEdit);
      setName(clientToEdit.name);
      setPhone(clientToEdit.phone || '');
      setCompany(clientToEdit.company || '');
      setDocument(clientToEdit.document || '');
      setEmail(clientToEdit.email || '');
    } else {
      setEditingClient(null);
      setName('');
      setPhone('');
      setCompany('');
      setDocument('');
      setEmail('');
    }
    setIsAddModalOpen(true);
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }

    const clientData: FreightClient = {
      id: editingClient?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cli_${Date.now()}`),
      name: name.trim(),
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      document: document.trim() || undefined,
      email: email.trim() || undefined,
      created_at: editingClient?.created_at || new Date().toISOString(),
    };

    freightStorage.saveClient(clientData, userId);
    toast.success(editingClient ? 'Cliente atualizado com sucesso!' : 'Novo cliente cadastrado!');
    refreshClients();
    setIsAddModalOpen(false);
  };

  const handlePromptDeleteClient = (client: FreightClient) => {
    setClientToDelete(client);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      setIsDeleting(true);
      freightStorage.deleteClient(clientToDelete.id, userId);
      toast.success(`Cliente ${clientToDelete.name} removido com sucesso.`);
      setClientToDelete(null);
      refreshClients();
    } catch (err: any) {
      toast.error('Erro ao excluir cliente: ' + (err?.message || 'Falha'));
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm)) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome, empresa, telefone ou e-mail..."
            className="pl-9 h-10 text-xs rounded-xl bg-card border-border/80"
          />
        </div>

        <Button
          onClick={() => handleOpenAddModal()}
          className="rounded-xl h-10 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 cursor-pointer shadow-xs shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Cadastrar Novo Cliente
        </Button>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/80 bg-muted/10 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted/40 text-muted-foreground mx-auto flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground">Nenhum cliente cadastrado</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Ao emitir orçamentos ou cadastrar contatos, eles ficarão salvos aqui para preenchimento rápido em 1 toque.
            </p>
          </div>
          <Button
            onClick={() => handleOpenAddModal()}
            size="sm"
            variant="outline"
            className="rounded-xl text-xs font-bold gap-1.5 cursor-pointer mt-2"
          >
            <UserPlus className="w-3.5 h-3.5 text-primary" />
            Adicionar Primeiro Cliente
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredClients.map((client) => {
            // Count quote history for this client
            const clientQuotes = quotes.filter(q => 
              q.client_name.toLowerCase() === client.name.toLowerCase() ||
              (client.phone && q.client_phone && q.client_phone.replace(/\D/g, '') === client.phone.replace(/\D/g, ''))
            );
            const totalSpent = clientQuotes
              .filter(q => q.status === 'approved' || q.status === 'completed')
              .reduce((acc, q) => acc + (q.total_price || 0), 0);

            return (
              <Card key={client.id} className="rounded-2xl border-border/80 bg-card hover:border-border transition-all shadow-2xs overflow-hidden flex flex-col justify-between">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        {client.name}
                      </h4>
                      {client.company && (
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Building className="w-3 h-3 text-indigo-500" />
                          {client.company}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenAddModal(client)}
                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Editar cliente"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handlePromptDeleteClient(client)}
                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-rose-600 cursor-pointer"
                        title="Excluir cliente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
                    {client.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-semibold text-foreground">{client.phone}</span>
                      </p>
                    )}
                    {client.email && (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </p>
                    )}
                    {client.document && (
                      <p className="text-[11px] text-muted-foreground">
                        CPF/CNPJ: {client.document}
                      </p>
                    )}
                  </div>

                  {/* Quote History Mini Tag */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {clientQuotes.length} orçamento(s) gerado(s)
                    </span>
                    {totalSpent > 0 && (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSpent)}
                      </span>
                    )}
                  </div>
                </CardContent>

                {onSelectClientForQuote && (
                  <div className="p-2.5 bg-muted/20 border-t border-border/60">
                    <Button
                      onClick={() => onSelectClientForQuote(client)}
                      size="sm"
                      className="w-full rounded-xl h-8 text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer gap-1.5"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Criar Orçamento para este Cliente
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Add/Edit Client */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="w-[94vw] sm:max-w-md p-0 overflow-hidden rounded-3xl border-border bg-card">
          <DialogHeader className="p-4 sm:p-5 bg-muted/30 border-b border-border/60">
            <DialogTitle className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {editingClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preencha os dados do cliente para facilitar a emissão de propostas de frete.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveClient} className="p-4 sm:p-5 space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-foreground">Nome Completo / Contato *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva ou Loja Central"
                required
                className="rounded-xl h-9.5 text-xs bg-muted/10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">WhatsApp / Telefone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="rounded-xl h-9.5 text-xs bg-muted/10"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Nome da Empresa</label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Ex: Distribuidora ABC"
                  className="rounded-xl h-9.5 text-xs bg-muted/10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-foreground">CPF ou CNPJ</label>
                <Input
                  value={document}
                  onChange={(e) => setDocument(maskCpfCnpj(e.target.value))}
                  placeholder="000.000.000-00"
                  className="rounded-xl h-9.5 text-xs bg-muted/10"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">E-mail Comercial</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@empresa.com"
                  className="rounded-xl h-9.5 text-xs bg-muted/10"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-border/50 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-xl h-9 text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="rounded-xl h-9 text-xs font-black bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                Salvar Cliente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CLIENTE */}
      <Dialog open={!!clientToDelete} onOpenChange={(open) => {
        if (!open && !isDeleting) {
          setClientToDelete(null);
        }
      }}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-border bg-card shadow-2xl">
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-foreground">
                  Remover Cliente?
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Tem certeza que deseja remover este contato da sua lista de clientes frequentes?
                </DialogDescription>
              </div>
            </div>

            {clientToDelete && (
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-foreground">{clientToDelete.name}</h4>
                  {clientToDelete.company && (
                    <span className="font-semibold text-[11px] text-muted-foreground bg-background px-2 py-0.5 rounded-lg border border-border/60">
                      {clientToDelete.company}
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-muted-foreground text-[11px] pt-1.5 border-t border-border/40">
                  {clientToDelete.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-emerald-500" />
                      <span>{clientToDelete.phone}</span>
                    </p>
                  )}
                  {clientToDelete.email && (
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 text-blue-500" />
                      <span>{clientToDelete.email}</span>
                    </p>
                  )}
                  {clientToDelete.document && (
                    <p className="text-[10.5px]">
                      CPF/CNPJ: {clientToDelete.document}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => setClientToDelete(null)}
              className="rounded-xl h-9 px-4 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isDeleting}
              onClick={confirmDeleteClient}
              className="rounded-xl h-9 px-4 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white gap-1.5 cursor-pointer shadow-xs"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Remover Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
