import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyProvider } from "@/lib/key-context";
import { AdminProvider } from "@/lib/admin-context";
import LoginPage from "./pages/Login";
import PainelPage from "./pages/Painel";
import AdminPage from "./pages/Admin";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="bottom-center" theme="dark" richColors closeButton />
      <BrowserRouter>
        <KeyProvider>
          <AdminProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/painel" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/painel" element={<PainelPage />} />
              <Route path="/admin" element={<AdminPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AdminProvider>
        </KeyProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

