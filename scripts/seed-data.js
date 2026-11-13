// Date demo. Utilizatorii sunt referiți prin username, filmele prin titlu.

export const FILMS = [
  { owner: 'ana', title: 'Moartea domnului Lăzărescu', year: 2005, genre: 'drama', description: 'O noapte lungă în care un pensionar bolnav este plimbat de la un spital la altul.' },
  { owner: 'ana', title: '4 luni, 3 săptămâni și 2 zile', year: 2007, genre: 'drama', description: 'Două studente într-o zi apăsătoare din România anilor ’80.' },
  { owner: 'mihai', title: 'Inception', year: 2010, genre: 'sf', description: 'O echipă care fură idei pătrunzând în visele altor oameni primește o misiune inversă.' },
  { owner: 'mihai', title: 'Mad Max: Fury Road', year: 2015, genre: 'actiune', description: 'O cursă fără oprire prin deșert, cu o fugă îndrăzneață de sub un tiran.' },
  { owner: 'elena', title: 'Călătoria lui Chihiro', year: 2001, genre: 'animatie', description: 'O fetiță rătăcită într-o lume a spiritelor trebuie să-și salveze părinții.' },
  { owner: 'elena', title: 'Amélie', year: 2001, genre: 'romantic', description: 'O chelneriță timidă din Paris decide să schimbe în secret viețile celor din jur.' },
  { owner: 'ana', title: 'The Grand Budapest Hotel', year: 2014, genre: 'comedie', description: 'Aventurile unui concierge legendar și ale tânărului său ucenic.' },
  { owner: 'mihai', title: 'Get Out', year: 2017, genre: 'horror', description: 'O vizită la familia iubitei se transformă într-un coșmar tot mai straniu.' },
  { owner: 'elena', title: 'Free Solo', year: 2018, genre: 'documentar', description: 'Un alpinist își pregătește urcarea fără coardă pe un perete de granit uriaș.' },
  { owner: 'admin', title: 'Interstellar', year: 2014, genre: 'sf', description: 'Un grup de exploratori caută prin spațiu o nouă casă pentru omenire.' },
  { owner: 'mihai', title: 'Parasite', year: 2019, genre: 'thriller', description: 'O familie săracă se infiltrează, pe rând, în casa unei familii bogate.' },
  { owner: 'elena', title: 'Frăția inelului', year: 2001, genre: 'fantasy', description: 'Un hobbit pornește într-o călătorie periculoasă pentru a distruge un inel.' },
  { owner: 'ana', title: 'Up', year: 2009, genre: 'animatie', description: 'Un văduv morocănos își ridică locuința în aer cu mii de baloane.' },
  { owner: 'admin', title: 'Pulp Fiction', year: 1994, genre: 'thriller', description: 'Povești încrucișate din lumea interlopă a Los Angelesului.' },
];

export const REVIEWS = [
  { user: 'ana', film: 'Inception', rating: 5, body: 'Complicat, dar merită fiecare minut. Finalul încă mă bântuie.' },
  { user: 'ana', film: 'Parasite', rating: 5, body: 'Începe ca o comedie și te lasă fără cuvinte.' },
  { user: 'mihai', film: 'Moartea domnului Lăzărescu', rating: 4, body: 'Greu de privit, dar foarte bine făcut.' },
  { user: 'mihai', film: 'Călătoria lui Chihiro', rating: 5, body: 'Animație superbă, poveste pentru toate vârstele.' },
  { user: 'elena', film: 'Inception', rating: 4, body: 'Efecte excelente, poate puțin prea lung.' },
  { user: 'elena', film: 'Mad Max: Fury Road', rating: 3, body: 'Spectaculos, dar prea puțină poveste pentru gustul meu.' },
  { user: 'ana', film: 'Free Solo', rating: 4, body: 'Mi-au transpirat palmele tot filmul.' },
  { user: 'mihai', film: 'Amélie', rating: 4, body: 'Cald și jucăuș, cu o coloană sonoră minunată.' },
  { user: 'elena', film: 'Get Out', rating: 5, body: 'Inteligent și tensionat de la început până la sfârșit.' },
  { user: 'admin', film: 'Frăția inelului', rating: 5, body: 'Un clasic care nu îmbătrânește.' },
  { user: 'mihai', film: 'Up', rating: 5, body: 'Primele zece minute sunt cele mai triste din animație.' },
  { user: 'elena', film: 'The Grand Budapest Hotel', rating: 4, body: 'Fiecare cadru arată ca o ilustrație.' },
];

// Lista privată de vizionare: tocmai datele pe care ceilalți utilizatori nu trebuie să le vadă.
export const WATCHLIST = [
  { user: 'ana', film: 'Inception', status: 'vazut', watchedOn: '2026-09-14', note: 'Văzut cu Andrei la cinematograful din cartier.' },
  { user: 'ana', film: 'Interstellar', status: 'de_vazut', note: 'De văzut în weekend, pe ecranul mare.' },
  { user: 'ana', film: 'Pulp Fiction', status: 'de_vazut', note: '' },
  { user: 'ana', film: 'Parasite', status: 'vazut', watchedOn: '2026-10-02', note: 'Recomandat de colega de birou.' },
  { user: 'mihai', film: 'Călătoria lui Chihiro', status: 'vazut', watchedOn: '2026-08-21', note: 'Seară de film cu sora mea.' },
  { user: 'mihai', film: 'Frăția inelului', status: 'de_vazut', note: 'Maraton cu toată trilogia de Crăciun.' },
  { user: 'mihai', film: 'Free Solo', status: 'de_vazut', note: '' },
  { user: 'elena', film: 'Get Out', status: 'vazut', watchedOn: '2026-10-31', note: 'Halloween acasă.' },
  { user: 'elena', film: 'Moartea domnului Lăzărescu', status: 'de_vazut', note: 'Pentru cursul de film românesc.' },
  { user: 'elena', film: 'Up', status: 'de_vazut', note: '' },
  { user: 'admin', film: 'Amélie', status: 'de_vazut', note: '' },
  { user: 'admin2', film: 'Mad Max: Fury Road', status: 'vazut', watchedOn: '2026-07-11', note: 'Revăzut pentru a treia oară.' },
];
