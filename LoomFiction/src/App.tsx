import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { BooksPage } from './modules/books/pages/BooksPage';
import { BookDetailPage } from './modules/books/pages/BookDetailPage';
import { ChapterEditorPage } from './modules/chapters/pages/ChapterEditorPage';
import { ChapterReadPage } from './modules/chapters/pages/ChapterReadPage';
import { ChapterVersionsPage } from './modules/chapters/pages/ChapterVersionsPage';
import { NotFound } from './pages/404';
import { IdeasPage } from './modules/ideas/pages/IdeasPage';
import { IdeaVersionsPage } from './modules/ideas/pages/IdeaVersionsPage';
import VersionsHubPage from './pages/VersionsHubPage';
//import { ImportPage } from './pages/ImportPage';
import { SheetPage } from './modules/sheets/pages/SheetPage';
// import DonatePage from './pages/DonatePage';
import ExportPage from './pages/ExportPage';
import { SheetVersionsPage } from './modules/sheets/pages/SheetVersionPage';
import { FeedbackProvider } from './components/feedback/FeedbackProvider';
import { AppExplorer } from './components/explorer/AppExplorer';
import { useExplorerOpen } from './hooks/explorerOpenStore';
import { IsolatedIdeasPage } from './modules/ideas/pages/IsolatedIdeasPage';
//import { TermsPage } from './pages/TermsPage';
//import { PrivacyPage } from './pages/PrivacyPage';
//import { SupportPage } from './pages/SupportPage';


const WITH_NAVBAR =
  '[--nav-top:3.5rem] sm:[--nav-top:4rem] [--nav-bottom:calc(4rem+env(safe-area-inset-bottom))] sm:[--nav-bottom:0px]';
const NAVBAR_COLLAPSED =
  '[--nav-top:3.5rem] sm:[--nav-top:0px] [--nav-bottom:calc(4rem+env(safe-area-inset-bottom))] sm:[--nav-bottom:0px]';
const WITHOUT_NAVBAR = '[--nav-top:0px] [--nav-bottom:0px]';

function AppContent() {
  const { pathname } = useLocation();
  const [isExplorerOpen] = useExplorerOpen();

  const inVersions = pathname.includes('/versions');
  const showNavbar = !(
    ['/', '/terms', '/privacy', '/support'].includes(pathname) ||
    pathname.includes('/read') ||
    (pathname.includes('/chapters/') && !inVersions) ||
    (pathname.includes('/ideas/fiches/') && !inVersions) ||
    (pathname.includes('/ideas/libres') && !inVersions)
  );

  const collapseNavbar = showNavbar && isExplorerOpen;
  const layoutVars = !showNavbar ? WITHOUT_NAVBAR : collapseNavbar ? NAVBAR_COLLAPSED : WITH_NAVBAR;

  return (
    <div className={`min-h-dvh bg-[var(--c-page)] flex flex-col ${layoutVars}`}>
      {showNavbar && <Navbar collapsed={collapseNavbar} />}

      <div className="flex grow items-start">
        {/* Explorateur unique, monté une seule fois à gauche du contenu (il se masque tout seul sur l'accueil et en lecture) */}
        <AppExplorer />

        <main className={`grow min-w-0 self-stretch flex flex-col ${showNavbar ? 'pb-[var(--nav-bottom)]' : ''}`}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/books" element={<BooksPage />} />
          <Route path="/books/:id" element={<BookDetailPage />} />
          <Route path="/books/:bookId/chapters/:chapterId" element={<ChapterEditorPage />} />
          <Route path="/books/:bookId/chapters/:chapterId/versions" element={<ChapterVersionsPage />} />
          <Route path="/books/:bookId/chapters/:chapterId/versions/:versionId" element={<ChapterVersionsPage />} />
          <Route path="/books/:bookId/chapters/:chapterId/read" element={<ChapterReadPage />} />
          <Route path="/ideas" element={<IdeasPage />} />
          {/* <Route path="/donate" element={<DonatePage />} /> */}
          <Route path="/versions" element={<VersionsHubPage />} />
          <Route path="/ideas/:ideaId/versions" element={<IdeaVersionsPage />} />
          <Route path="/ideas/:ideaId/versions/:versionId" element={<IdeaVersionsPage />} />
          <Route path="/export" element={<ExportPage />} />
          {/* <Route path="/import" element={<ImportPage />} /> */}
          <Route path="/ideas/fiches/:sheetId" element={<SheetPage />} />
          <Route path="/ideas/fiches/:sheetId/versions" element={<SheetVersionsPage />} />
          <Route path="/ideas/fiches/:sheetId/versions/:versionId" element={<SheetVersionsPage />} />
          {/* <Route path="/terms" element={<TermsPage />} /> */}
          {/* <Route path="/privacy" element={<PrivacyPage />} /> */}
          {/* <Route path="/support" element={<SupportPage />} /> */}
          <Route path="/ideas/libres" element={<IsolatedIdeasPage />} />
          <Route path="/github" element={<a href="https://github.com/jonathandecroix28-max/loomfiction" target="_blank" rel="noopener noreferrer">GitHub</a>} />

          {/* Route 404 */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
    <FeedbackProvider>

      <AppContent />
    </FeedbackProvider>
    </BrowserRouter>
  );
}

export default App;