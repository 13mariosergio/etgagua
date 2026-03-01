import Pedidos from "./Pedidos";
import PushNotificationManager from "../components/PushNotificationManager";
import "./Entregador.css";

export default function Entregador() {
  return (
    <div className="ent-page">
      <h2 className="ent-title">Entregador</h2>
      <p className="ent-sub">
        Foco em pedidos em rota e finalização (EM_ROTA → ENTREGUE/CANCELADO).
      </p>

      <div className="ent-box">
        <PushNotificationManager />
        <Pedidos modo="ENTREGADOR" />
      </div>
    </div>
  );
}
