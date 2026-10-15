import {render} from 'preact';
import {LocationProvider, ErrorBoundary, Router, Route} from 'preact-iso';

import HomePage from './pages/HomePage.jsx';
import CustomerPage from './pages/CustomerPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default async () => {
  render(<App />, document.body);
};

function App() {
  return (
    <LocationProvider>
      {/* The app name in the sidebar also links to `/`; this link names the page. */}
      <s-app-nav>
        <s-link href="/">Customers</s-link>
      </s-app-nav>
      <ErrorBoundary>
        <Router>
          <Route path="/" component={HomePage} />
          <Route path="/customers/:id" component={CustomerPage} />
          <Route default component={NotFoundPage} />
        </Router>
      </ErrorBoundary>
    </LocationProvider>
  );
}
