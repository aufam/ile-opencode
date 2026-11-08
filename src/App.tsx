import { Route, Router, A } from "@solidjs/router";
import { AuthProvider } from "./stores/auth";
import { RequireRole } from "./components/ui";
import { ToastProvider } from "./stores/toast";
import { Login } from "./modules/auth/Login";
import { PublicReview } from "./modules/public/PublicReview";
import { StaffDashboard } from "./modules/staff/StaffDashboard";
import { NewTransaction } from "./modules/staff/NewTransaction";
import { TransactionHub } from "./modules/staff/TransactionHub";
import { BackroomAppraisal } from "./modules/staff/BackroomAppraisal";
import { PaymentPage } from "./modules/staff/PaymentPage";
import { Presentation } from "./modules/staff/Presentation";
import { MgmtDashboard } from "./modules/mgmt/MgmtDashboard";
import { MgmtTransactions } from "./modules/mgmt/MgmtTransactions";
import { MgmtTransactionDetail } from "./modules/mgmt/MgmtTransactionDetail";
import { MgmtStaff } from "./modules/mgmt/MgmtStaff";
import { MgmtStaffDetail } from "./modules/mgmt/MgmtStaffDetail";
import { MgmtPrices } from "./modules/mgmt/MgmtPrices";
import { MgmtBranches } from "./modules/mgmt/MgmtBranches";
import { ToastHost, HomeRedirect } from "./components/toast-host";

function StaffGate(props: { children?: unknown }) {
  return <RequireRole role="staff">{props.children as never}</RequireRole>;
}

function MgmtGate(props: { children?: unknown }) {
  return <RequireRole role="management">{props.children as never}</RequireRole>;
}

function NotFound() {
  return (
    <div class="public-page" style="display:grid; place-items:center">
      <div style="text-align:center">
        <img src="/logo.png" alt="" style="width:70px; border-radius:16px" />
        <h1 style="font-size:26px; margin:12px 0 6px; font-family: var(--serif)">Halaman tidak ditemukan</h1>
        <p class="hint" style="margin-bottom:16px">
          Periksa kembali tautan, atau kembali ke dasbor Anda.
        </p>
        <A class="btn gold" href="/login">
          Ke halaman masuk
        </A>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Route path="/login" component={Login} />
          <Route path="/public/review/:token" component={PublicReview} />
          <Route
            path="/present/:id"
            component={() => (
              <RequireRole role="staff">
                <Presentation />
              </RequireRole>
            )}
          />

          <Route path="/staff" component={StaffGate}>
            <Route path="/" component={StaffDashboard} />
            <Route path="/new" component={NewTransaction} />
            <Route path="/transactions/:id" component={TransactionHub} />
            <Route path="/transactions/:id/backroom" component={BackroomAppraisal} />
            <Route path="/transactions/:id/payment" component={PaymentPage} />
          </Route>

          <Route path="/management" component={MgmtGate}>
            <Route path="/" component={MgmtDashboard} />
            <Route path="/transactions" component={MgmtTransactions} />
            <Route path="/transactions/:id" component={MgmtTransactionDetail} />
            <Route path="/staff" component={MgmtStaff} />
            <Route path="/staff/:id" component={MgmtStaffDetail} />
            <Route path="/prices" component={MgmtPrices} />
            <Route path="/branches" component={MgmtBranches} />
          </Route>

          <Route path="/" component={HomeRedirect} />
          <Route path="*" component={NotFound} />
        </Router>
        <ToastHost />
      </ToastProvider>
    </AuthProvider>
  );
}
