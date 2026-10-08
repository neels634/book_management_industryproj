/* Sample catalogue for demos. Titles/authors are real; ISBNs are synthetic but checksum-valid. */

const categories = [
  { name: 'Fiction', description: 'Novels, short stories and literary fiction' },
  { name: 'Non-fiction', description: 'Essays, memoirs and general non-fiction' },
  { name: 'Science', description: 'Physics, biology, astronomy and popular science' },
  { name: 'Technology', description: 'Computing, software engineering and engineering' },
  { name: 'History', description: 'World, regional and military history' },
  { name: 'Biography', description: 'Biographies and autobiographies' },
  { name: 'Business', description: 'Management, economics and finance' },
  { name: 'Philosophy', description: 'Philosophy, ethics and religion' },
  { name: 'Children', description: 'Picture books and young readers' },
];

// [title, authors, category, publisher, year, copies, price, shelf]
const books = [
  ['To Kill a Mockingbird', ['Harper Lee'], 'Fiction', 'J. B. Lippincott', 1960, 5, 399, 'F-01'],
  ['1984', ['George Orwell'], 'Fiction', 'Secker & Warburg', 1949, 6, 299, 'F-02'],
  ['Pride and Prejudice', ['Jane Austen'], 'Fiction', 'T. Egerton', 1813, 4, 249, 'F-03'],
  ['The God of Small Things', ['Arundhati Roy'], 'Fiction', 'IndiaInk', 1997, 4, 450, 'F-04'],
  ['The Great Gatsby', ['F. Scott Fitzgerald'], 'Fiction', "Charles Scribner's Sons", 1925, 3, 275, 'F-05'],
  ['Midnight\'s Children', ['Salman Rushdie'], 'Fiction', 'Jonathan Cape', 1981, 3, 499, 'F-06'],
  ['The Alchemist', ['Paulo Coelho'], 'Fiction', 'HarperCollins', 1988, 6, 350, 'F-07'],
  ['One Hundred Years of Solitude', ['Gabriel Garcia Marquez'], 'Fiction', 'Harper & Row', 1967, 2, 520, 'F-08'],
  ['Sapiens: A Brief History of Humankind', ['Yuval Noah Harari'], 'Non-fiction', 'Harvill Secker', 2011, 5, 599, 'N-01'],
  ['Thinking, Fast and Slow', ['Daniel Kahneman'], 'Non-fiction', 'Farrar, Straus and Giroux', 2011, 3, 650, 'N-02'],
  ['Atomic Habits', ['James Clear'], 'Non-fiction', 'Avery', 2018, 6, 499, 'N-03'],
  ['A Brief History of Time', ['Stephen Hawking'], 'Science', 'Bantam Books', 1988, 4, 399, 'S-01'],
  ['The Selfish Gene', ['Richard Dawkins'], 'Science', 'Oxford University Press', 1976, 3, 450, 'S-02'],
  ['Cosmos', ['Carl Sagan'], 'Science', 'Random House', 1980, 3, 550, 'S-03'],
  ['The Gene: An Intimate History', ['Siddhartha Mukherjee'], 'Science', 'Scribner', 2016, 2, 699, 'S-04'],
  ['The Origin of Species', ['Charles Darwin'], 'Science', 'John Murray', 1859, 2, 299, 'S-05'],
  ['Clean Code', ['Robert C. Martin'], 'Technology', 'Prentice Hall', 2008, 5, 750, 'T-01'],
  ['The Pragmatic Programmer', ['Andrew Hunt', 'David Thomas'], 'Technology', 'Addison-Wesley', 1999, 4, 820, 'T-02'],
  ['Introduction to Algorithms', ['Thomas H. Cormen', 'Charles E. Leiserson', 'Ronald L. Rivest', 'Clifford Stein'], 'Technology', 'MIT Press', 2009, 6, 1250, 'T-03'],
  ['Design Patterns', ['Erich Gamma', 'Richard Helm', 'Ralph Johnson', 'John Vlissides'], 'Technology', 'Addison-Wesley', 1994, 3, 990, 'T-04'],
  ['Designing Data-Intensive Applications', ['Martin Kleppmann'], 'Technology', "O'Reilly Media", 2017, 4, 1100, 'T-05'],
  ['You Don\'t Know JS Yet', ['Kyle Simpson'], 'Technology', 'Independently published', 2020, 3, 600, 'T-06'],
  ['The Discovery of India', ['Jawaharlal Nehru'], 'History', 'Signet Press', 1946, 3, 399, 'H-01'],
  ['Guns, Germs, and Steel', ['Jared Diamond'], 'History', 'W. W. Norton', 1997, 3, 550, 'H-02'],
  ['India After Gandhi', ['Ramachandra Guha'], 'History', 'Picador', 2007, 2, 799, 'H-03'],
  ['The Silk Roads', ['Peter Frankopan'], 'History', 'Bloomsbury', 2015, 2, 650, 'H-04'],
  ['Wings of Fire', ['A. P. J. Abdul Kalam', 'Arun Tiwari'], 'Biography', 'Universities Press', 1999, 6, 299, 'B-01'],
  ['The Story of My Experiments with Truth', ['M. K. Gandhi'], 'Biography', 'Navajivan', 1927, 4, 199, 'B-02'],
  ['Steve Jobs', ['Walter Isaacson'], 'Biography', 'Simon & Schuster', 2011, 3, 799, 'B-03'],
  ['Long Walk to Freedom', ['Nelson Mandela'], 'Biography', 'Little, Brown', 1994, 2, 599, 'B-04'],
  ['Zero to One', ['Peter Thiel', 'Blake Masters'], 'Business', 'Crown Business', 2014, 3, 499, 'BU-01'],
  ['The Lean Startup', ['Eric Ries'], 'Business', 'Crown Business', 2011, 3, 550, 'BU-02'],
  ['Rich Dad Poor Dad', ['Robert Kiyosaki'], 'Business', 'Warner Books', 1997, 4, 350, 'BU-03'],
  ['Meditations', ['Marcus Aurelius'], 'Philosophy', 'Penguin Classics', 180, 3, 250, 'P-01'],
  ['The Republic', ['Plato'], 'Philosophy', 'Penguin Classics', 375, 2, 299, 'P-02'],
  ['The Very Hungry Caterpillar', ['Eric Carle'], 'Children', 'World Publishing', 1969, 4, 199, 'C-01'],
  ['Harry Potter and the Philosopher\'s Stone', ['J. K. Rowling'], 'Children', 'Bloomsbury', 1997, 6, 450, 'C-02'],
  ['Matilda', ['Roald Dahl'], 'Children', 'Jonathan Cape', 1988, 3, 299, 'C-03'],
];

// [name, email, phone, type, limit, status]
const members = [
  ['Aarav Mehta', 'aarav.mehta@example.com', '+91 98200 10001', 'STUDENT', 3, 'ACTIVE'],
  ['Diya Iyer', 'diya.iyer@example.com', '+91 98200 10002', 'STUDENT', 3, 'ACTIVE'],
  ['Rohan Kapoor', 'rohan.kapoor@example.com', '+91 98200 10003', 'FACULTY', 6, 'ACTIVE'],
  ['Ananya Gupta', 'ananya.gupta@example.com', '+91 98200 10004', 'PUBLIC', 3, 'ACTIVE'],
  ['Vikram Singh', 'vikram.singh@example.com', '+91 98200 10005', 'FACULTY', 6, 'ACTIVE'],
  ['Meera Nair', 'meera.nair@example.com', '+91 98200 10006', 'STUDENT', 3, 'ACTIVE'],
  ['Kabir Das', 'kabir.das@example.com', '+91 98200 10007', 'PUBLIC', 2, 'ACTIVE'],
  ['Ishita Banerjee', 'ishita.b@example.com', '+91 98200 10008', 'STAFF', 4, 'ACTIVE'],
  ['Arjun Reddy', 'arjun.reddy@example.com', '+91 98200 10009', 'STUDENT', 3, 'ACTIVE'],
  ['Sneha Patil', '', '+91 98200 10010', 'PUBLIC', 3, 'ACTIVE'],
  ['Farhan Qureshi', 'farhan.q@example.com', '+91 98200 10011', 'STUDENT', 3, 'ACTIVE'],
  ['Lakshmi Menon', 'lakshmi.menon@example.com', '+91 98200 10012', 'FACULTY', 6, 'ACTIVE'],
  ['Nikhil Joshi', 'nikhil.joshi@example.com', '+91 98200 10013', 'PUBLIC', 3, 'SUSPENDED'],
  ['Pooja Chawla', 'pooja.chawla@example.com', '+91 98200 10014', 'STUDENT', 3, 'ACTIVE'],
  ['Sameer Khan', 'sameer.khan@example.com', '+91 98200 10015', 'PUBLIC', 3, 'ACTIVE'],
  ['Tara Fernandes', 'tara.f@example.com', '+91 98200 10016', 'STAFF', 4, 'INACTIVE'],
];

// Demo logins. Change these passwords before any real deployment.
const users = [
  { name: 'Asha Admin', username: 'admin', password: 'Admin@1234', role: 'ADMIN' },
  { name: 'Leela Librarian', username: 'librarian', password: 'Librarian@1234', role: 'LIBRARIAN' },
  // Linked to the first member above (Aarav Mehta).
  { name: 'Aarav Mehta', username: 'member', password: 'Member@1234', role: 'MEMBER', memberIndex: 0 },
];

module.exports = { categories, books, members, users };
