# Conversion Review — v1 (prototyp desktop, warianty C i D)

> **Czym jest ten raport.** Audytowany artefakt to **klikalny prototyp projektowy**, nie działający sklep. Pytanie, na które odpowiada ten raport, brzmi więc: **co pojedzie źle, jeśli to zostanie zaimplementowane tak, jak zaprojektowano** — a nie „czy prototyp działa".
>
> Wszystko, co jest rusztowaniem makiety (statyczne pola formularza, brak analityki, dane demo, liczniki-placeholdery, częściowo podpięte filtry), jest **poza zakresem ustaleń** i zebrane osobno w sekcji *Luki handoffu*. Pierwsza wersja tego raportu tej granicy nie utrzymała i liczyła rusztowanie jako wady; ta wersja ją zastępuje.

## Metadane audytu
- **Data:** 2026-07-26 18:00:12
- **Artefakt:** prototyp `desktop-redesign/`, serwowany lokalnie na `http://localhost:8899`
- **Repo:** `desktop-redesign` — `main`, commit `ca5dbf0` ("Shorter C cards, orange guided checkout CTA, logged-in/out prototype switch"), drzewo czyste
- **Zakres:** warianty **C i D** na polecenie użytkownika — `home-c.html`, `home-d.html`, `listing-c.html`, `hotel.html`, `checkout.html`, `thankyou.html`. Warianty A/B wyłączone.
- **Tryb:** HEURISTIC — brak analityki, brak ruchu, brak backendu. **Żadna liczba zasięgu w tym raporcie nie jest zmierzona.** Przy prototypie przedpremierowym to stan normalny, nie brak dostępu.
- **Widok:** desktop 1440×900. Prototyp jest 1440px-only, więc obowiązkowe przejścia mobilne z protokołu nie miały czego audytować.
- **Języki:** RO. Bliźniaki `*-en.html` **nie sprawdzone** — patrz *Czego nie sprawdziłem*.
- **Przejścia:** 4 · **pełne ścieżki cenowe:** 3
- **Efekty uboczne:** brak (lokalny statyczny prototyp, tylko `localStorage`)

### Drzewo KPI (wyprowadzone, niepotwierdzone przez użytkownika)
- **P0 — opłacona rezerwacja** (zaliczka 30% lub pełna płatność) na własnym inwentarzu czarterowym. LITRO ma **dwie równoległe ścieżki P0**: online z natychmiastowym potwierdzeniem oraz call-center (0241 999). Raty, karty wakacyjne, vouchery, storno i anulacje są w produkcji wyłącznie telefoniczne.
- **Mikrokonwersje:** wyszukanie → listing → otwarcie hotelu → wybór taryfy → start checkoutu → próba płatności → potwierdzenie. Plus dwie boczne, które *wychodzą* z lejka cyfrowego zamiast go przerywać: prośba o callback, ujawnienie numeru.
- **P1:** udział pełnej przedpłaty → wskaźnik anulacji → AOV → kontakty z call-center na 100 rezerwacji → FRIENDS → zgody marketingowe.

## Co prototyp robi dobrze

Odnotowuję to najpierw, bo to nie są drobiazgi i łatwo je zepsuć przy naprawianiu reszty:

- **Kwota jest stabilna od kafla do checkoutu** — trzy pełne ścieżki cenowe, zero drip pricingu.
- **Taxa de stațiune** poprawnie wyłączona z ceny i nazwana jako płatna w hotelu, konsekwentnie na wszystkich ekranach.
- **Żaden płatny dodatek nie jest zaznaczony domyślnie** — zweryfikowane w markupie całego przepływu C/D.
- **Zgoda zakupowa jest odseparowana od marketingowej**, marketingowa oznaczona „opțional" z prawem wycofania, a CTA jest **realnie zablokowane** do akceptacji T&C (`proto.js:1326-1365`).
- **Żadna nakładka nie odpala się w checkoucie.**
- **Pasek pobytu na stronie hotelu edytuje daty i gości w miejscu**, bez powrotu do wyszukiwarki — to dobra decyzja projektowa i rzadka.
- **Stan pustego wyniku istnieje** i sadza konsultanta dokładnie tam, gdzie ma sens (ślepy zaułek), zgodnie z modelem „telefon jako skalpel".
- **Wiersze „indisponibil online"** są wizualnie oddzielone od pokoi dostępnych natychmiast — uczciwe wobec użytkownika i zgodne z realnym inwentarzem.

## Tabela śledzenia ceny

Trzy pełne ścieżki, zapisane na każdym kroku.

| Ścieżka | Stan wyszukiwania | Karta wyniku | Karta rezerwacji (hotel) | Pasek rezerwacji | Checkout |
|---|---|---|---|---|---|
| **A** | Mamaia, 5–12 cze, 2 dorosłych, 1 pokój | 5 975 Lei | 5 975 Lei | 5 975 Lei | **5 975 Lei** online + ≈50 Lei taxa w hotelu |
| **B** | Mamaia, 5–12 cze, **6 dorosłych + 2 dzieci, 3 pokoje** | **5 975 Lei**, podpisane „6 adulți, 7 nopți" | **5 975 Lei**, podpisane „**1 × Cameră dublă · 2 adulți**" | 5 975 Lei, „1 camere · 2 adulți" | — |
| **C** | Mamaia, **10–17 wrz**, 2 dorosłych, 1 pokój | 5 310 Lei | 5 310 Lei | — | — |

Odczyt: cena **jest stabilna** i **poprawnie reaguje na sezon i liczbę nocy** (ścieżka C). Nie reaguje na skład grupy ani liczbę pokoi, a podpis twierdzi, że reaguje (ścieżka B) — to jest ustalenie CONV-01, i jest to brak w **modelu danych oferty**, nie nieświeże dane demo.

## Ustalenia

| ID | Obszar | Ustalenie | Waga | Klasa | Dowód | Wysiłek | Lokalizacja |
|---|---|---|---|---|---|---|---|
| CONV-07 | 13, 15, 17 | Karta rezerwacji domyślnie odbija **pierwszy** wiersz taryf — „Nerambursabil · plată în avans" — i reklamuje nad nim „Anulare gratuită" oraz „Nu plătești nimic acum" | **critical** · LEGAL:material | Leak | [OBSERVED] | S | `hotel.html:136,139`; `proto.js:478` |
| CONV-01 | 7, 11, 12 | Popyt wielopokojowy i rodzinny nie ma zaprojektowanej reprezentacji: model oferty nie ma wymiaru obłożenia, a podpis ceny mimo to nazywa skład grupy | **critical** | Blocker (dla tego segmentu) | [OBSERVED] | M | `proto.js:437,454-455`; model karty `data-ppn`/`data-disc` |
| CONV-02 | 13, 20 | Najważniejszy warunek zakupu — termin darmowej anulacji — ma **trzy różne zapisy** na trzech ekranach, w tym błędny obok poprawnej reguły w jednej linijce | **medium** · LEGAL:material | Leak | [OBSERVED] | S | `hotel.html:139,267,276,329`; `checkout.html:173`; `thankyou.html:118,181`; `proto.js:1389` |
| CONV-10 | 10, 6 | Wariant C nie pokazuje **żadnej** wycenionej oferty w pierwszym ekranie (pierwsza cena na y=1803); wariant D pokazuje jedną (pierwsza karta y=663, 74% ekranu to chrom) | **medium** | Leak | [OBSERVED] | M | `home-c.html`, `home-d.html` |
| CONV-12 | 8 | Stan pustego wyniku nie nazywa blokującego filtra, nie pozwala usunąć go jednym kliknięciem i nie proponuje najbliższych alternatyw z licznikami | **low** | Friction | [CODE] | S | `proto.js:794-806` |

### CONV-07 — „Anulare gratuită" nad taryfą bezzwrotną

**Co się dzieje.** `proto.js:478` wybiera `$('tr.sel[data-total]') || $('tr[data-ppn]')` — dopóki użytkownik nic nie wybrał, karta rezerwacji odbija **pierwszy** wiersz taryf. Tym wierszem jest „Înscrieri Timpurii 2026 · −15%", który sama tabela opisuje jako „**Nerambursabil · plată în avans**". Karta renderuje nad nim „✓ Anulare gratuită până la 20 mai" i „Nu plătești nimic acum". W checkoucie ta sama taryfa dostaje zielony pas „✓ Anulare gratuită", a CTA „Rezervă și plătește avansul →" stoi nad notką „Nu plătești nimic acum până confirmi rezervarea".

**Dlaczego kosztuje.** Klient wybiera najtańszą taryfę wierząc, że jest zwrotna i że dziś nic nie płaci — jedno i drugie jest dla niej nieprawdą. Koszt wraca później jako spór o zwrot albo telefon, czyli dokładnie ta pozycja kosztowa, którą redesign ma obniżyć. To także najczystsza ekspozycja na zarzut wprowadzania w błąd w całym prototypie, bo odznaka jest bezwarunkowa nad mieszaną tabelą taryf.

**Naprawa.** Podepnij pasek korzyści i notkę o płatności pod **wybraną** taryfę, nie pod domyślny szablon. I nie ustawiaj domyślnie taryfy niosącej warunki anulacji — pokaż zwrotną i bezzwrotną obok siebie z podaną różnicą ceny.

**Najmniejszy wdrażalny wycinek:** nie renderuj paska korzyści, dopóki taryfa nie jest wybrana. Jeden warunek, usuwa fałszywą obietnicę bez przeprojektowania tabeli.

**DoD:** żadna obietnica dotycząca anulacji ani terminu płatności nie renderuje się bez wybranej taryfy i każda zgadza się z jej własnymi polami polityki.

### CONV-01 — Rodzina i wiele pokoi nie mają zaprojektowanej reprezentacji

**Co się dzieje.** Po ustawieniu 6 dorosłych + 2 dzieci + 3 pokoje karta pokazuje **5 975 Lei**, identycznie jak dla 2 dorosłych i 1 pokoju, a podpis zmienia się na „**6 adulți, 7 nopți cu mic dejun**" — dzieci znikają z niego całkowicie. Na stronie hotelu kontekst jedzie poprawnie w URL i pasek pobytu pokazuje „6 adulți + 2 copii · 3 camere", **bezpośrednio obok** karty rezerwacji „1 × Cameră dublă vedere mare · 2 adulți · 5 975 Lei". Model danych karty (`data-ppn`, `data-disc`, `data-meal`, `data-beach`…) nie ma żadnego wymiaru obłożenia.

**Dlaczego to nie jest kwestia mocka.** Że konkretne liczby są zmyślone — oczywiście. Ustaleniem jest to, że **projekt nie rozstrzyga, jak wygląda oferta dla grupy większej niż pojemność jednostki**: czy pokoje się składa, czy karta pokazuje „od X / pokój", czy pasek pobytu i karta rezerwacji się godzą, gdzie wchodzą przedziały wiekowe dzieci (realne 0–9,99 i 0–13,99, sterujące ceną i wstępem). Zespół wdrożeniowy dostaje ekran, który tę sprzeczność pokazuje, i żadnej wskazówki, jak ją rozwiązać. Na produkcie plażowym to jest segment rdzeniowy.

**Naprawa.** Rozstrzygnij w projekcie: pojemność jednostki i mnożnik pokoi w modelu oferty, reguła przedziałów wiekowych, oraz zaprojektowany stan „grupa nie mieści się w tej jednostce" na karcie i na stronie hotelu. Do czasu, gdy arytmetyka istnieje, podpis nie może nazywać składu grupy, którego nie wycenił — „de la X Lei / cameră" zamiast „6 adulți".

**Najmniejszy wdrażalny wycinek:** zmiana samego podpisu (`proto.js:437`, `:454-455`), żeby nazywał **wycenioną** jednostkę zamiast `S.adults`. Usuwa fałszywe twierdzenie natychmiast; model obłożenia to reszta.

**DoD:** żaden podpis ceny nie nazywa składu grupy, dla którego cena nie została policzona.

### CONV-02 — Trzy zapisy tego samego warunku anulacji

**Co się dzieje.** Dla tej samej rezerwacji na 5 czerwca współistnieją trzy terminy: `hotel.html` i `checkout.html:173` mówią **20 mai**, modal warunków (`proto.js:1389`) i potwierdzenie (`thankyou.html`) mówią **26 mai**. Realna reguła — anulacja na co najmniej 10 dni przed przyjazdem — daje **26 mai**. `checkout.html:173` podaje przy tym błędną datę i poprawną regułę **w jednej linijce**: „Anulare gratuită până la 20 mai (cu 10 zile înainte de check-in)".

**Dlaczego to nie jest kwestia mocka.** Że daty są zaszyte w makiecie — naturalne. Ustaleniem jest to, że **projekt nie ma jednej kanonicznej reprezentacji swojego najważniejszego warunku zakupu** i trzy ekrany podają trzy wartości. To wjedzie do implementacji jako trzy niezależne stringi, dokładnie tak, jak powstało tutaj. Kierunek też ma znaczenie: 20 mai **zaniża elastyczność klienta o sześć dni** na dwóch ekranach, na których elastyczność jest warunkiem zakupu, i prostuje się dopiero po zapłaceniu.

**Naprawa.** Jedna wyliczana wartość (`przyjazd − 10 dni`, z godziną 23:59, jak już robi potwierdzenie), podpięta wszędzie. To samo dotyczy terminu dopłaty.

**DoD:** zmiana dat pobytu przesuwa każdą wyrenderowaną datę anulacji i dopłaty; wszystkie ekrany pokazują jedną wartość.

### CONV-10 — Pierwszy ekran nie sprzedaje inwentarza

**Co się dzieje.** Mierzone `getBoundingClientRect()` przy 1440×900, z ukrytymi panelami demo.

- **Wariant C:** pierwsza wyceniona oferta na **y=1803** — dwa pełne ekrany w dół, za karuzelą kampanii (y=120), heroem z wyszukiwarką (y=352), „Inspiră-te pentru următoarea vacanță" (y=621), „Căutările tale recente" (y=911) i „Rezervă la noi!" (y=1086). **Zero** wycenionych, rezerwowalnych ofert w pierwszym ekranie.
- **Wariant D:** pierwsza karta na **y=663** z 900px, czyli widoczna **jedna** oferta. Powyżej: promobar 38 + header 66 + karuzela 214 + hero z wyszukiwarką 243 + pasek sortowania — **74% pierwszego ekranu** to chrom i marketing, na stronie, której cała teza brzmi „strona główna JEST listingiem".

**Dlaczego kosztuje.** LITRO sprzedaje własny czarter, więc oferta jest produktem. Kto nie widzi wycenionej oferty nad foldem, nie odbiera, że **jest wybór** — a najmocniejsza rzecz, jaką firma ma (realny, rezerwowalny inwentarz z natychmiastowym potwierdzeniem), zostaje najpierw opowiedziana prozą, zanim zostanie pokazana. D jest bliżej własnej tezy niż C; żaden do niej nie dociera.

**Naprawa.** W D przytnij stos chromu nad listą — karuzela kampanii i hero z wyszukiwarką nie mogą obie posiadać pierwszego ekranu; cel to dwie pełne karty widoczne przy 900px. W C przenieś blok wycenionych ofert nad „Inspiră-te" i „Rezervă la noi!", które są treścią zaufaniową i inspiracyjną, a więc należą **za** produktem.

**Najmniejszy wdrażalny wycinek:** sama zmiana kolejności sekcji w `home-c.html` — czysty markup, bez nowych komponentów, i to jest większa z dwóch luk.

**DoD:** przy 1440×900 co najmniej dwie wycenione karty ofert są przynajmniej częściowo widoczne w pierwszym ekranie obu wariantów strony głównej.

### CONV-12 — Ślepy zaułek złapany, ale niezdiagnozowany

**Co się dzieje.** Blok ratunkowy renderuje „Niciun rezultat pentru filtrele alese", przycisk „Șterge filtrele" czyszczący **wszystkie** filtry, i numer konsultanta. Nie mówi, który filtr wyzerował wynik, nie pozwala usunąć tylko jego, i nie proponuje najbliższych alternatyw z licznikami — mimo że pasek elastycznych dat już istnieje w kodzie i jest na tym szablonie pokazywany przy małej liczbie wyników.

**Dlaczego kosztuje.** „Wyczyść wszystko" wyrzuca całą intencję użytkownika, żeby uciec od jednego złego filtra, więc realnym następnym krokiem jest wyjście albo telefon — a telefon to koszt, który redesign ma obniżać, wydany tu na przypadek, który produkt mógł rozwiązać sam.

**Naprawa.** Nazwij blokującą fasetę i pozwól usunąć dokładnie ją; wystaw sąsiednie terminy i pobliskie kurorty z licznikami, reużywając istniejącego paska elastycznych dat; konsultant jako trzecia opcja, nie druga.

## Ekspozycja prawna

Tylko dwa ustalenia opisują to, co realnie pojedzie na produkcję jako ryzyko prawne:

| ID | Instrument | Kierunek konwersyjny |
|---|---|---|
| **CONV-07** | UCPD 2005/29/WE art. 6–7 (bezwarunkowa korzyść nad mieszaną polityką), w RO Legea 363/2007 | **Dodatni** — usunięcie sprzeczności usuwa też źródło sporów o zwrot |
| **CONV-02** | UCPD art. 7 (wprowadzające w błąd pominięcie); obowiązki przedkontraktowe, artykuł do potwierdzenia | **Dodatni** — poprawna data daje klientowi **więcej** elastyczności niż pokazywana dziś |

Obie naprawy są konwersyjnie dodatnie, co jest rzadkie i warto to wykorzystać argumentacyjnie.

**Nie zgłaszam jako ustaleń**, ale zapisuję jako warunek dla handoffu: cena referencyjna i licznik wygaśnięcia oferty staną się problemem prawnym **dopiero przy implementacji** i tylko wtedy, gdy projekt nie zamówi pod nie danych — patrz *Luki handoffu*. Przy kwestii ceny referencyjnej dochodzi pytanie, czy rumuńska transpozycja Omnibusa (art. 6a) obejmuje **usługi** noclegowe, co rozstrzyga, czy przekreślona cena w ogóle jest w zakresie — **do potwierdzenia z prawnikiem**.

## Luki handoffu

To nie są wady prototypu. To rzeczy, których prototyp **nie rozstrzyga**, a zespół wdrożeniowy będzie musiał rozstrzygnąć sam — czyli miejsca, gdzie projekt zdecyduje się przez zaniechanie.

1. **Checkout jako formularz nie został zaprojektowany.** Przepływ C/D pokazuje formularz *wypełniony* (`<div class="inp"><b>Ana</b></div>`), więc każdy dotychczasowy przegląd oglądał obrazek sukcesu. Brakuje: stanu pustego jako domyślnego do przeglądu, kolejności i wymagalności pól, konwencji adresowej RO (Județ + Oraș, bez pola State, diakrytyki, prefiks +40), walidacji i stanów błędu, oraz tokenów `autocomplete` — bez nich odpada autouzupełnianie i menedżery adresów, a ścieżka zakupowa przestaje być operowalna klawiaturą, co pod EAA jest blokadą, nie kosmetyką. **To najbardziej kosztowna luka na tej liście**, bo dotyczy kroku o najwyższym tarciu.
2. **Kontrakt zdarzeń powinien jechać razem z `litro.css`.** Redesign ma zdjąć ruch z call-center czynnego 10:00–18:00. Druga ścieżka P0 biegnie przez telefon i jest niewidoczna dla analityki webowej z definicji, więc jeśli callback, ujawnienie numeru i rezerwacja domknięta przez konsultanta nie zostaną zaprojektowane jako mierzalne zdarzenia **teraz**, teza „telefon jako skalpel" pozostanie opinią także po starcie. Dorzuć wymiar wariantu, żeby pytanie C vs D dało się kiedyś rozstrzygnąć dowodem.
3. **Cena referencyjna potrzebuje pola w kontrakcie oferty.** Dziś przekreślona kwota jest wyliczana z odznaki rabatu (`total/(1−disc)`), więc nie istnieje miejsce, w którym mogłaby zamieszkać najniższa cena z 30 dni. Zamów pole historii cen (per jednostka, rynek, waluta, retencja ≥30 dni) i licz procent **z** referencji, a nie referencję z procentu. Ma najdłuższy czas realizacji z całej listy i cicho bramkuje zgodność powierzchni, które jeszcze nie istnieją (feedy, maile).
4. **Wygaśnięcie oferty potrzebuje daty końca kampanii.** „expiră în 4 zile" jako string zaimplementuje się jako string. Programy ofertowe LITRO naprawdę wygasają, więc uczciwa wersja jest dostępna — trzeba ją tylko zamówić.
5. **Rozstrzygnij, które fasety filtrów są prawdziwe.** Szyna pokazuje 37 pozycji z licznikami; do demo podpięto 5. Liczniki sugerują kontrakt fasetowy oparty o dostępność — albo go zamów, albo przytnij szynę do tego, co realne. Krótka uczciwa szyna bije długą dekoracyjną.
6. **Dane demo na `thankyou.html` są niespójne** (dopłata 2 832 vs 4 182 Lei, bo część węzłów odmalowuje `proto.js`, a część została przy literałach z czasu projektowania). Nie jest to wada projektu, ale myli osoby przeglądające makietę — warto wyrównać, żeby przegląd tego ekranu dotyczył projektu, a nie arytmetyki.

## Czego nie sprawdziłem

- **Wersje EN** (`home-c-en`, `home-d-en`, `listing-c-en`, `hotel-en`, `checkout-en`, `thankyou-en`) — nie przeszedłem. Skoro CONV-02 pokazuje, że ten sam warunek ma trzy zapisy w jednym języku, bliźniaki EN są najwyżej rokującym następnym sprawdzeniem.
- **Wszystko mobilne** — prototyp jest 1440px-only.
- **Wszystko za kontrolką zatwierdzenia:** metody płatności, autoryzacja, 3DS, odmowy, odzyskiwanie nieopłaconych rezerwacji, dostarczalność maili. Prototyp nie ma integracji płatniczej.
- **Wydajność, cache, rewalidacja dostępności, strefy czasowe** — brak backendu.
- **Ścieżka konsultanta** istnieje (`tr.rate-request`, blok ratunkowy) — nie przeszedłem jej end-to-end.
- **Autentyczność recenzji, ujawnienie zasad rankingu, kody promocyjne** — brak danych i backendu.

## Rekomendacja sekwencji

1. **CONV-07 i CONV-02 najpierw** — obie są małe, obie są konwersyjnie dodatnie i obie dotyczą warunków anulacji, czyli warunku zakupu w modelu LITRO. Razem to jeden dzień pracy projektowej.
2. **CONV-01 jako decyzja projektowa, nie poprawka** — jak wygląda oferta dla grupy nieMieszczącej się w jednostce. Wymaga rozstrzygnięcia, zanim ktokolwiek zacznie wdrażać model oferty.
3. **Zaprojektuj checkout jako formularz** (luka 1) przed następnym przeglądem projektowym, nie po. Dopóki nie istnieje, ten krok jest nieaudytowalny, a zespół wdrożeniowy specyfikuje go przez zaniechanie.
4. **Rozstrzygnij C vs D na pomiarze folda, nie na preferencji** (CONV-10) — ale najpierw napraw stos chromu w obu, żeby wybór odbywał się między dwiema uczciwymi wersjami.
5. **Kontrakt zdarzeń i pole historii cen** (luki 2 i 3) dołóż do handoffu — mają najdłuższy czas realizacji i bramkują rzeczy, które jeszcze nie istnieją.

## Niezmienniki do ochrony

Reguły, których przyszłe zmiany nie powinny łamać — kandydaci na testy regresji:

- Żadna obietnica dotycząca anulacji ani terminu płatności nie renderuje się bez wybranej taryfy i zgadza się z jej polityką.
- Taryfa niosąca warunki anulacji (zwrotna vs bezzwrotna) nigdy nie jest domyślnie wybrana.
- Termin anulacji jest liczony raz jako `przyjazd − 10 dni`; wszystkie powierzchnie podpięte do tej jednej wartości.
- Żaden podpis ceny nie nazywa składu grupy, dla którego cena nie została policzona.
- Taxa de stațiune zostaje poza ceną nagłówkową i nazwana jako płatna w hotelu — na każdej powierzchni. *(dziś poprawne — chronić)*
- Żaden płatny dodatek nie jest zaznaczony domyślnie; zgoda zakupowa pozostaje odseparowana od marketingowej i nadal bramkuje CTA. *(dziś poprawne — chronić)*
- Żadna nakładka nie odpala się na ścieżce checkoutu. *(dziś poprawne — chronić)*
- Przy 1440×900 co najmniej dwie wycenione karty ofert są widoczne w pierwszym ekranie strony głównej i listingu.
- Cena referencyjna pochodzi z zapisanej historii 30 dni; procent liczony z referencji, nigdy odwrotnie.

## Statystyka
- Ustalenia: **2 critical · 2 medium · 1 low** — z czego LEGAL:material: 2
- Klasa: Blocker 1 · Leak 3 · Friction 1
- Dowody: [OBSERVED] 4 · [CODE] 1
- Decyzje: SHIP 5 (brak ruchu i infrastruktury eksperymentów, więc żadne ustalenie nie mogło dostać próby o mocy statystycznej — to własność dojrzałości artefaktu, nie twierdzenie, że każda naprawa jest bez ryzyka)
- Luki handoffu: 6 · Przejścia: 4 · Pełne ścieżki cenowe: 3
