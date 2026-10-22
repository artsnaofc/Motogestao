/**
 * Real anonymized fixtures from Brazilian official sources (CVM IPE and B3/FNET)
 */

export const CVM_IPE_SAMPLE_CSV = `CNPJ_Companhia;Nome_Companhia;Codigo_CVM;Data_Referencia;Categoria;Tipo;Especie;Data_Entrega;Versao;Protocolo_Entrega;Link_Download
33.000.167/0001-01;PETROLEO BRASILEIRO S.A. - PETROBRAS;009512;2026-04-25;Relatório Proventos;Aviso aos Acionistas;;2026-04-25 18:30:00;1;1029384;https://dados.cvm.gov.br/doc/ipe/1029384
33.000.167/0001-01;PETROLEO BRASILEIRO S.A. - PETROBRAS;009512;2026-04-28;Relatório Proventos;Aviso aos Acionistas (Retificação);;2026-04-28 09:15:00;2;1029490;https://dados.cvm.gov.br/doc/ipe/1029490
33.592.510/0001-54;VALE S.A.;004170;2026-05-10;Relatório Proventos;Aviso aos Acionistas;;2026-05-10 19:00:00;1;1034561;https://dados.cvm.gov.br/doc/ipe/1034561
60.701.190/0001-04;ITAU UNIBANCO HOLDING S.A.;019348;2026-06-01;Relatório Proventos;Juros Sobre Capital Próprio;;2026-06-01 17:45:00;1;1045672;https://dados.cvm.gov.br/doc/ipe/1045672
00.000.000/0001-91;BANCO DO BRASIL S.A.;001023;2026-05-15;Fato Relevante;Fato Relevante Geral;;2026-05-15 18:00:00;1;1038920;https://dados.cvm.gov.br/doc/ipe/1038920
`;

export const CVM_PETROBRAS_DOC_HTML = `
<!DOCTYPE html>
<html>
<head><title>PETRÓLEO BRASILEIRO S.A. - AVISO AOS ACIONISTAS</title></head>
<body>
  <h1>PETRÓLEO BRASILEIRO S.A. - PETROBRAS</h1>
  <h2>CNPJ: 33.000.167/0001-01 - Companhia Aberta</h2>
  <p><strong>AVISO AOS ACIONISTAS: DISTRIBUIÇÃO DE REMUNERAÇÃO AOS ACIONISTAS</strong></p>
  <p>O Conselho de Administração da Petrobras aprovou a distribuição de remuneração aos acionistas no valor total de R$ 1,1460 por ação ordinária e preferencial.</p>
  
  <table border="1" id="proventos_detalhe">
    <thead>
      <tr>
        <th>Tipo</th>
        <th>ISIN / Ativo</th>
        <th>Valor Bruto por Ação (R$)</th>
        <th>Data de Corte (Data-Com)</th>
        <th>Data Ex-Direito</th>
        <th>Data de Pagamento</th>
        <th>Parcela</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Dividendo</td>
        <td>BRPETRACNOR9 (PETR3)</td>
        <td>0.57300000</td>
        <td>2026-04-25</td>
        <td>2026-04-28</td>
        <td>2026-05-20</td>
        <td>1ª Parcela</td>
      </tr>
      <tr>
        <td>Dividendo</td>
        <td>BRPETRACNPR6 (PETR4)</td>
        <td>0.57300000</td>
        <td>2026-04-25</td>
        <td>2026-04-28</td>
        <td>2026-05-20</td>
        <td>1ª Parcela</td>
      </tr>
      <tr>
        <td>Dividendo</td>
        <td>BRPETRACNOR9 (PETR3)</td>
        <td>0.57300000</td>
        <td>2026-04-25</td>
        <td>2026-04-28</td>
        <td>2026-06-20</td>
        <td>2ª Parcela</td>
      </tr>
      <tr>
        <td>Dividendo</td>
        <td>BRPETRACNPR6 (PETR4)</td>
        <td>0.57300000</td>
        <td>2026-04-25</td>
        <td>2026-04-28</td>
        <td>2026-06-20</td>
        <td>2ª Parcela</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`;

export const FNET_BTCI11_NOTICE_JSON = {
  id: "fnet_doc_984521",
  tipoDocumento: "Aviso aos Cotistas - Rendimentos",
  nomeFundo: "BTG PACTUAL CRÉDITO IMOBILIÁRIO FII",
  cnpjFundo: "10.424.234/0001-09",
  codigoNegociacao: "BTCI11",
  tipoEvento: "rendimento",
  dataInformacao: "2026-08-07",
  dataBase: "2026-08-07", // data-com
  dataEx: "2026-08-10",
  dataPagamento: "2026-08-14",
  valorPorCota: 0.10300000,
  mesAnoReferencia: "07/2026",
  rendimentoTributado: false,
  urlDocumento: "https://fnet.bmfbovespa.com.br/fnet/publico/visualizarDocumento?d=984521"
};

export const FNET_AMORTIZACAO_NOTICE_JSON = {
  id: "fnet_doc_987654",
  tipoDocumento: "Aviso aos Cotistas - Amortização Parcial de Cotas",
  nomeFundo: "FUNDO DE INVESTIMENTO IMOBILIÁRIO EXEMPLO",
  cnpjFundo: "22.333.444/0001-55",
  codigoNegociacao: "EXMP11",
  tipoEvento: "amortizacao",
  dataInformacao: "2026-09-01",
  dataBase: "2026-09-01",
  dataEx: "2026-09-02",
  dataPagamento: "2026-09-15",
  valorPorCota: 5.50000000,
  mesAnoReferencia: "08/2026",
  urlDocumento: "https://fnet.bmfbovespa.com.br/fnet/publico/visualizarDocumento?d=987654"
};
