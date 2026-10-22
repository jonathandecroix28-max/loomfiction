import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBooks } from '../hooks/useBooks';
import { useDeleteBook } from '../hooks/useDeleteBook';
import { useChapterCounts } from '../hooks/useChapterCounts';
import { BookCard } from '../components/BookCard';
import { BookModal } from '../components/BookModal';
//import { ImportBookButton } from '../components/ImportBookButton';

export function BooksPage() {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  
  const [searchParams, setSearchParams] = useSearchParams(); 
  const navigate = useNavigate();

  const { books, isLoading, error, setBooks } = useBooks();
  const { deleteBook } = useDeleteBook();
  const chapterCountOf = useChapterCounts(books);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsModalOpen(true);
      
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSelectBook = (bookId: number) => {
    navigate(`/books/${bookId}`);
  };

  const handleDeleteBook = async (bookId: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce livre ? Cette action est irréversible.")) {
      return;
    }

    const updatedBooks = await deleteBook(bookId);
    if (updatedBooks) {
      setBooks(updatedBooks);
    } else {
      alert("Erreur lors de la suppression du livre.");
    }
  };

  if (isLoading && books.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#1c1411]">
        <p className="text-lg text-amber-200/60 font-serif italic animate-pulse">Ouverture de la bibliothèque...</p>
      </div>
    );
  }

  if (error && books.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#1c1411]">
        <p className="text-red-400 font-serif font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1c1411] text-[#fcf9f2] px-4 sm:px-6 py-8 md:px-16 font-sans overflow-x-hidden">
      <div className="max-w-6xl mx-auto">

        {/* En-tête de la bibliothèque */}
        <div className="bg-neutral-950/70 border border-amber-900/30 rounded-3xl p-6 sm:p-8 md:p-10 shadow-xl mb-10 md:mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/5 rounded-bl-full pointer-events-none" />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 md:gap-6">
            <div>
              <span className="bg-amber-950 text-amber-300 font-sans font-semibold px-3 py-1 rounded-full text-xs tracking-wide uppercase border border-amber-800/40 inline-block mb-3">
                {books.length} {books.length > 1 ? 'romans' : 'roman'} enregistré{books.length > 1 ? 's' : ''}
              </span>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-amber-100 tracking-tight">
                Votre Bibliothèque
              </h1>
              <p className="text-amber-200/70 mt-2 font-serif italic text-lg max-w-xl">
                « Chaque livre est un univers en attente d'être exploré. »
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 w-full md:w-auto shrink-0">
              {/* <ImportBookButton className="w-full sm:w-auto" /> */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-sans font-medium px-5 py-3 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto touch-target"
              >
                <span className="text-lg leading-none">+</span> Nouveau Roman
              </button>
            </div>
          </div>
        </div>

        {/* Grille des cartes de livres */}
        {books.length === 0 ? (
          <div className="text-center py-16 sm:py-20 bg-neutral-950/50 rounded-3xl border border-dashed border-amber-900/30 px-6">
            <p className="text-amber-200/60 font-serif text-xl mb-2">Votre bibliothèque est vide.</p>
            <p className="text-xs text-amber-200/40 font-sans mb-6">Posez votre première pierre narrative dès aujourd'hui.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-amber-700 hover:bg-amber-600 text-amber-50 font-sans font-medium px-5 py-2.5 rounded-xl shadow-md transition text-sm cursor-pointer inline-flex items-center gap-2"
              >
                + Créer mon premier roman
              </button>
              {/* <ImportBookButton size="sm" /> */}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                chapterCount={chapterCountOf(book)}
                onSelect={handleSelectBook}
                onDelete={handleDeleteBook}
              />
            ))}
          </div>
        )}

      </div>

      <BookModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onBookCreated={(newBooksList) => setBooks(newBooksList)}
      />
    </div>
  );
}