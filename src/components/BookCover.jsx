export default function BookCover({ book, size = 'large' }) {
  return (
    <div
      className={`book-cover ${book.coverClass || 'cover-upload'} book-cover--${size}`}
      style={{ '--book-accent': book.accent || '#607d6d' }}
      aria-label={`${book.title} cover`}
    >
      {book.coverImage && <img src={book.coverImage} alt="" className="book-cover__art" />}
      <div className="book-cover__wash" />
      <div className="book-cover__content">
        <span className="book-cover__eyebrow">SMART READER</span>
        <strong>{book.title}</strong>
        <span className="book-cover__rule" />
        <small>{book.author}</small>
      </div>
      <span className="book-cover__shape book-cover__shape--one" />
      <span className="book-cover__shape book-cover__shape--two" />
    </div>
  );
}
