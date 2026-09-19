import { Navigate } from "react-router-dom";

/**
 * Qualquer rota desconhecida volta para o app (login/painel).
 */
const NotFound = () => <Navigate to="/painel" replace />;

export default NotFound;
