import { useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

export default function NovoPedido() {
  const nav = useNavigate();
  const [clienteNome, setClienteNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [observacao, setObservacao] = useState("");

  async function criarPedido(e) {
    e.preventDefault();
    try {
      await api.post("/pedidos", { clienteNome, telefone, endereco, observacao });
      nav("/");
    } catch (e2) {
      const msg = e2?.response?.data?.error || "Erro ao criar pedido.";
      alert(msg);
      console.error(e2);
    }
  }

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2 style={{ marginTop: 0 }}>Novo pedido</h2>

      <form onSubmit={criarPedido} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Nome do cliente *"
          value={clienteNome}
          onChange={(e) => setClienteNome(e.target.value)}
          required
        />
        <input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        <input
          placeholder="Endereço *"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          required
        />
        <input
          placeholder="Observação"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        <button type="submit">Salvar</button>
      </form>
    </div>
  );
}
