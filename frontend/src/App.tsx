import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import MensajesTelegram from './pages/MensajesTelegram'
import RegisterFingerprint from './pages/RegisterFingerprint'
import AdminMetricas from './pages/admin/AdminMetricas'
import FinanzasCartera from './pages/admin/FinanzasCartera'
import FinanzasConfig from './pages/admin/FinanzasConfig'
import FinanzasEstadoCuenta from './pages/admin/FinanzasEstadoCuenta'
import FinanzasMovimientos from './pages/admin/FinanzasMovimientos'
import ListarPropietarios from './pages/admin/ListarPropietarios'
import RegistrarPropietario from './pages/admin/RegistrarPropietario'
import SalonesSociales from './pages/admin/SalonesSociales'
import PropietarioDashboard from './pages/propietario/PropietarioDashboard'
import ReservarSalonSocial from './pages/propietario/ReservarSalonSocial'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import VerificarAcceso from './pages/vigilante/VerificarAcceso'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Super Admin-only routes */}
          <Route element={<ProtectedRoute allowedRoles={['superadmin']} />}>
            <Route
              path="/superadmin/conjuntos"
              element={
                <Layout>
                  <SuperAdminDashboard />
                </Layout>
              }
            />
          </Route>

          {/* Propietario-only routes */}
          <Route element={<ProtectedRoute allowedRoles={['propietario']} />}>
            <Route
              path="/propietario/dashboard"
              element={
                <Layout>
                  <PropietarioDashboard />
                </Layout>
              }
            />
            <Route
              path="/propietario/salones-sociales"
              element={
                <Layout>
                  <ReservarSalonSocial />
                </Layout>
              }
            />
          </Route>

          {/* Admin-only routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route
              path="/admin/metricas"
              element={
                <Layout>
                  <AdminMetricas />
                </Layout>
              }
            />
            <Route
              path="/admin/registrar"
              element={
                <Layout>
                  <RegistrarPropietario />
                </Layout>
              }
            />
            <Route
              path="/admin/propietarios"
              element={
                <Layout>
                  <ListarPropietarios />
                </Layout>
              }
            />
            <Route
              path="/admin/finanzas/movimientos"
              element={
                <Layout>
                  <FinanzasMovimientos />
                </Layout>
              }
            />
            <Route
              path="/admin/finanzas/cartera"
              element={
                <Layout>
                  <FinanzasCartera />
                </Layout>
              }
            />
            <Route
              path="/admin/finanzas/config"
              element={
                <Layout>
                  <FinanzasConfig />
                </Layout>
              }
            />
            <Route
              path="/admin/finanzas/propietarios/:uid"
              element={
                <Layout>
                  <FinanzasEstadoCuenta />
                </Layout>
              }
            />
            <Route
              path="/admin/mensajes"
              element={
                <Layout>
                  <MensajesTelegram />
                </Layout>
              }
            />
            <Route
              path="/admin/salones-sociales"
              element={
                <Layout>
                  <SalonesSociales />
                </Layout>
              }
            />
          </Route>

          {/* Vigilante-only routes */}
          <Route element={<ProtectedRoute allowedRoles={['vigilante']} />}>
            <Route
              path="/vigilante/verificar"
              element={
                <Layout>
                  <VerificarAcceso />
                </Layout>
              }
            />
            <Route
              path="/vigilante/mensajes"
              element={
                <Layout>
                  <MensajesTelegram />
                </Layout>
              }
            />
          </Route>

          {/* Shared authenticated routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'vigilante']} />}>
            <Route
              path="/perfil/huella"
              element={
                <Layout>
                  <RegisterFingerprint />
                </Layout>
              }
            />
          </Route>

          {/* Fallbacks */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
