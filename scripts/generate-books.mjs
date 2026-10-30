import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { mkdir, writeFile } from 'node:fs/promises';

const books = [
  {
    slug: 'the-art-of-noticing',
    title: 'The Art of Noticing',
    shortTitle: ['The Art of', 'Noticing'],
    author: 'Elena Marlowe',
    subject: 'Mindful living',
    pages: 12,
    palette: { paper: '#F7F3E9', ink: '#23493D', accent: '#D9865B', soft: '#DCE5D8' },
    quote: 'Attention is the rarest and purest form of generosity.',
    chapter: ['The quiet ritual', 'of reading'],
    headings: ['Make a little room', 'The texture of attention', 'An unhurried page', 'What we keep', 'The world returns', 'A practice of curiosity', 'Small, deliberate joys', 'A note to remember'],
    paragraphs: [
      'There is a particular kind of quiet that arrives when we give something our whole attention. The room does not change, and yet it feels more spacious. A page becomes a place to rest rather than another thing to finish.',
      'Begin with a small ritual. Put your phone beyond reach. Find a comfortable pool of light. Let your shoulders soften. These gestures are not rules; they are invitations. They tell the mind that, for a little while, there is nowhere else to be.',
      'Reading slowly is not the same as reading without purpose. You are making space for the sentence to unfold, for an idea to find its shape. You may pause on a phrase, follow a memory, or look out of the window. This, too, is part of reading.',
      'The books that stay with us are rarely the ones we rushed to complete. They are the ones that met us at the right moment. A margin note, a folded corner, a line copied into a notebook: these small traces turn a document into a conversation.',
      'Curiosity is a gentle form of courage. It asks us to remain open a little longer, to resist the easy conclusion. When you notice a question forming, do not hurry past it. Write it down. Give it a place to live.',
      'Try collecting one detail from every reading session. It might be an unexpected word, a useful idea, or simply the way the afternoon light moved across the page. Over time, these details become a map of your inner life.',
      'A meaningful reading life is built from returns, not records. Return to the passage that moved you. Return on the days when concentration feels impossible. One attentive page is enough to keep the door open.',
    ],
  },
  {
    slug: 'designing-a-meaningful-life',
    title: 'Designing a Meaningful Life',
    shortTitle: ['Designing a', 'Meaningful Life'],
    author: 'Adrian Chen',
    subject: 'Design & creativity',
    pages: 10,
    palette: { paper: '#F5F0E8', ink: '#303B50', accent: '#E3A34F', soft: '#E8DCC7' },
    quote: 'The life you shape begins with the things you choose to notice.',
    chapter: ['Design begins', 'with intention'],
    headings: ['Start with why', 'Remove the noise', 'Useful can be beautiful', 'Build for real days', 'Leave room for surprise', 'A kinder constraint', 'The work continues'],
    paragraphs: [
      'Good design begins before the first sketch. It begins with a careful look at the life already being lived: the routines, frustrations, workarounds, and tiny moments of delight that reveal what truly matters.',
      'To make space for meaning, begin by removing what competes with it. Fewer alerts. Fewer obligations accepted out of habit. Fewer objects that ask for attention without offering anything in return.',
      'Beauty is not a layer added at the end. It is the feeling that every part belongs. A useful object, a well-paced day, and a generous conversation can all possess this quiet coherence.',
      'Design for the Tuesday when everything goes wrong, not only the perfect morning. The best systems bend without breaking. They welcome you back after absence and make the next step obvious.',
      'Leave a little unfinished. A margin, an open afternoon, a question without an immediate answer. Possibility needs somewhere to sit. Without empty space, even the best plan can become a cage.',
      'A constraint can be an act of care. A clear boundary protects attention and gives energy a direction. Choose constraints that help you become more present, not merely more productive.',
      'A meaningful life is not a finished artifact. It is a practice of noticing, adjusting, and beginning again. Keep what serves you. Change what does not. Let the design remain alive.',
    ],
  },
  {
    slug: 'the-slow-living-handbook',
    title: 'The Slow Living Handbook',
    shortTitle: ['The Slow Living', 'Handbook'],
    author: 'Maya Bennett',
    subject: 'Wellness',
    pages: 8,
    palette: { paper: '#F6F2EA', ink: '#3C5148', accent: '#A68AB7', soft: '#E6DFE9' },
    quote: 'Slow down enough to be present for your own life.',
    chapter: ['A gentler way', 'to move through days'],
    headings: ['The first hour', 'Enough for today', 'A table, a window', 'The pleasure of ordinary things', 'Rest without earning it'],
    paragraphs: [
      'The beginning of a day does not need to be conquered. Try entering it instead. Open a window, drink something warm, and notice one sound outside. Let your attention arrive before your agenda.',
      'There will always be more to do. Enough is not a finish line reached when the list is empty; it is a decision to honor your limits. Choose what matters and let the rest wait without apology.',
      'Create one corner that belongs to unhurried time. It need not be beautiful by anyone else’s measure. A chair you love, a table with space for a cup, and natural light are plenty.',
      'Ordinary rituals become rich when we stop rushing through them. Washing vegetables, watering a plant, walking the familiar road home: presence reveals the detail that hurry conceals.',
      'Rest is not a reward for usefulness. It is a basic rhythm of being alive. You do not need to finish everything before you sit down. Sometimes the most generous thing is simply to stop.',
    ],
  },
];

function hex(value) {
  const n = parseInt(value.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function wrap(text, font, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function centered(page, text, y, font, size, color, width = 612) {
  const x = (width - font.widthOfTextAtSize(text, size)) / 2;
  page.drawText(text, { x, y, font, size, color });
}

async function createBook(book) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(book.title);
  pdf.setAuthor(book.author);
  pdf.setSubject(book.subject);
  pdf.setCreator('Smart Reader');
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paper = hex(book.palette.paper);
  const ink = hex(book.palette.ink);
  const accent = hex(book.palette.accent);
  const soft = hex(book.palette.soft);

  const addBase = () => {
    const page = pdf.addPage([612, 792]);
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: paper });
    return page;
  };

  // Cover
  {
    const page = addBase();
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: ink });
    page.drawCircle({ x: 470, y: 610, size: 92, color: accent });
    page.drawCircle({ x: 485, y: 626, size: 58, color: ink });
    page.drawRectangle({ x: 0, y: 0, width: 612, height: 230, color: soft });
    page.drawCircle({ x: 72, y: 155, size: 180, color: soft });
    page.drawCircle({ x: 512, y: 55, size: 210, color: accent });
    page.drawCircle({ x: 380, y: 65, size: 118, color: paper });
    page.drawText('SMART READER EDITIONS', { x: 62, y: 718, font: sansBold, size: 9, color: paper, characterSpacing: 2.2 });
    page.drawText(book.shortTitle[0], { x: 58, y: 510, font: serif, size: 51, color: paper });
    page.drawText(book.shortTitle[1], { x: 58, y: 450, font: serif, size: 51, color: paper });
    page.drawLine({ start: { x: 62, y: 394 }, end: { x: 126, y: 394 }, thickness: 2, color: accent });
    page.drawText(book.author.toUpperCase(), { x: 62, y: 360, font: sans, size: 11, color: paper, characterSpacing: 1.8 });
    page.drawText(book.subject, { x: 62, y: 66, font: sans, size: 10, color: ink });
  }

  // Title and epigraph
  {
    const page = addBase();
    centered(page, book.title, 545, serif, 36, ink);
    centered(page, book.author, 510, sans, 11, ink);
    page.drawLine({ start: { x: 276, y: 464 }, end: { x: 336, y: 464 }, thickness: 1.5, color: accent });
    const lines = wrap(`“${book.quote}”`, serifItalic, 22, 360);
    lines.forEach((line, index) => centered(page, line, 330 - index * 32, serifItalic, 22, ink));
    centered(page, 'A BOOK FOR UNHURRIED MOMENTS', 82, sans, 8, ink);
  }

  // Contents
  {
    const page = addBase();
    page.drawText('Contents', { x: 70, y: 670, font: serif, size: 42, color: ink });
    page.drawText('A small collection of ideas to return to.', { x: 72, y: 638, font: serifItalic, size: 14, color: ink });
    const items = [book.chapter.join(' '), ...book.headings.slice(0, book.pages - 4)];
    items.forEach((item, index) => {
      const y = 558 - index * 55;
      page.drawText(String(index + 1).padStart(2, '0'), { x: 74, y, font: sans, size: 9, color: accent });
      page.drawText(item, { x: 120, y: y - 2, font: serif, size: 17, color: ink });
      page.drawText(String(index + 4).padStart(2, '0'), { x: 505, y, font: sans, size: 9, color: ink });
      page.drawLine({ start: { x: 120, y: y - 16 }, end: { x: 518, y: y - 16 }, thickness: 0.4, color: soft });
    });
    page.drawText(book.title.toUpperCase(), { x: 70, y: 42, font: sans, size: 7, color: ink, characterSpacing: 1.2 });
    page.drawText('03', { x: 510, y: 42, font: sans, size: 8, color: ink });
  }

  // Chapter opener
  {
    const page = addBase();
    page.drawText('01', { x: 72, y: 688, font: sansBold, size: 10, color: accent, characterSpacing: 1.5 });
    page.drawText('A CHAPTER ON ATTENTION', { x: 108, y: 688, font: sans, size: 9, color: ink, characterSpacing: 1.5 });
    page.drawCircle({ x: 480, y: 655, size: 56, color: soft });
    page.drawCircle({ x: 498, y: 672, size: 33, color: paper });
    page.drawText(book.chapter[0], { x: 68, y: 532, font: serif, size: 47, color: ink });
    page.drawText(book.chapter[1], { x: 68, y: 475, font: serif, size: 47, color: ink });
    page.drawLine({ start: { x: 72, y: 420 }, end: { x: 140, y: 420 }, thickness: 3, color: accent });
    const intro = wrap(book.paragraphs[0], serif, 16, 435);
    intro.forEach((line, index) => page.drawText(line, { x: 72, y: 356 - index * 25, font: serif, size: 16, color: ink }));
    page.drawText('“', { x: 62, y: 150, font: serif, size: 72, color: accent });
    const quoteLines = wrap(book.quote, serifItalic, 20, 400);
    quoteLines.forEach((line, index) => page.drawText(line, { x: 105, y: 166 - index * 29, font: serifItalic, size: 20, color: ink }));
    page.drawText(book.title.toUpperCase(), { x: 70, y: 42, font: sans, size: 7, color: ink, characterSpacing: 1.2 });
    page.drawText('04', { x: 510, y: 42, font: sans, size: 8, color: ink });
  }

  for (let pageNumber = 5; pageNumber <= book.pages; pageNumber += 1) {
    const page = addBase();
    const paragraph = book.paragraphs[(pageNumber - 4) % book.paragraphs.length];
    const nextParagraph = book.paragraphs[(pageNumber - 3) % book.paragraphs.length];
    const heading = book.headings[(pageNumber - 5) % book.headings.length];
    page.drawText(book.title.toUpperCase(), { x: 68, y: 718, font: sans, size: 7, color: ink, characterSpacing: 1.3 });
    page.drawText(String(pageNumber).padStart(2, '0'), { x: 512, y: 718, font: sans, size: 8, color: ink });
    page.drawLine({ start: { x: 68, y: 699 }, end: { x: 528, y: 699 }, thickness: 0.6, color: soft });
    page.drawText(heading, { x: 68, y: 620, font: serif, size: 33, color: ink });
    page.drawRectangle({ x: 68, y: 590, width: 38, height: 3, color: accent });
    const lines = wrap(paragraph, serif, 15, 448);
    lines.forEach((line, index) => page.drawText(line, { x: 68, y: 535 - index * 24, font: serif, size: 15, color: ink }));
    const quoteY = 535 - lines.length * 24 - 54;
    page.drawRectangle({ x: 68, y: quoteY - 65, width: 4, height: 75, color: accent });
    const pullQuote = wrap('“' + book.quote + '”', serifItalic, 18, 385);
    pullQuote.slice(0, 2).forEach((line, index) => page.drawText(line, { x: 92, y: quoteY - index * 27, font: serifItalic, size: 18, color: ink }));
    const secondLines = wrap(nextParagraph, serif, 15, 448);
    secondLines.slice(0, 7).forEach((line, index) => page.drawText(line, { x: 68, y: quoteY - 115 - index * 24, font: serif, size: 15, color: ink }));
    page.drawText('SMART READER', { x: 68, y: 42, font: sans, size: 7, color: ink, characterSpacing: 1.4 });
    page.drawCircle({ x: 519, y: 46, size: 4, color: accent });
  }

  return pdf.save();
}

await mkdir('public/books', { recursive: true });
for (const book of books) {
  const bytes = await createBook(book);
  await writeFile(`public/books/${book.slug}.pdf`, bytes);
  console.log(`Created ${book.title} (${book.pages} pages)`);
}
