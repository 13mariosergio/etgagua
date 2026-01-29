import AdminUsers from "./AdminUsers";
import AdminProdutos from "./AdminProdutos";

export default function Admin() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <h2 style={{ margin: 0 }}>Administrador</h2>

      {/* Cadastro de usuários */}
      <AdminUsers />

      {/* Cadastro de produtos / águas */}
      <AdminProdutos />
    </div>
  );
}
