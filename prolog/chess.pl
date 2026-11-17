:- module(chess_ai, [fen_state/2, legal_moves/2, apply_move/3, in_check/2, choose_move/5, move_json/2, perft/3]).
:- use_module(library(lists)).
:- use_module(library(pairs)).

% state(Piezas, Turno, DerechosEnroque, CapturaAlPaso, MedioReloj, NumeroJugada).
% Las coordenadas van de 1 a 8; piece(Color, Tipo, Columna, Fila).
other(w, b). other(b, w).
piece_type(p). piece_type(n). piece_type(b). piece_type(r). piece_type(q). piece_type(k).

fen_state(Fen, state(Board, Turn, Rights, Ep, Half, Full)) :-
    string(Fen), string_length(Fen, Length), Length < 150,
    split_string(Fen, " ", "", [Placement, Side, Castling, EnPassant, HalfText, FullText]),
    atom_string(Turn, Side), memberchk(Turn, [w,b]),
    split_string(Placement, "/", "", Rows), length(Rows, 8),
    fen_rows(Rows, 8, Board),
    findall(1, member(piece(w,k,_,_), Board), [_]),
    findall(1, member(piece(b,k,_,_), Board), [_]),
    ( Castling = "-" -> Rights = [] ; string_chars(Castling, Rights),
      forall(member(Right, Rights), memberchk(Right, ['K','Q',k,q])), sort(Rights, Unique), same_length(Rights, Unique) ),
    ( EnPassant = "-" -> Ep = none ; square_text(EnPassant, EX, EY), memberchk(EY, [3,6]), Ep = sq(EX,EY) ),
    number_string(Half, HalfText), integer(Half), Half >= 0,
    number_string(Full, FullText), integer(Full), Full >= 1.

fen_rows([], 0, []).
fen_rows([Row|Rows], Y, Board) :-
    string_chars(Row, Chars), fen_row(Chars, 1, Y, Pieces), NextY is Y-1,
    fen_rows(Rows, NextY, Rest), append(Pieces, Rest, Board).
fen_row([], 9, _, []).
fen_row([Char|Chars], X, Y, Pieces) :-
    ( char_type(Char, digit), atom_number(Char, Count), between(1,8,Count)
    -> NextX is X+Count, NextX =< 9, Pieces = Rest
    ; downcase_atom(Char, Type), piece_type(Type), between(1,8,X),
      (char_type(Char, upper) -> Color = w ; Color = b),
      Pieces = [piece(Color,Type,X,Y)|Rest], NextX is X+1 ),
    fen_row(Chars, NextX, Y, Rest).

square_text(Text, X, Y) :- string_codes(Text, [File, Rank]), between(97,104,File), between(49,56,Rank), X is File-96, Y is Rank-48.
square_string(X, Y, Text) :- File is X+96, Rank is Y+48, string_codes(Text, [File,Rank]).
inside(X,Y) :- between(1,8,X), between(1,8,Y).
empty(Board,X,Y) :- \+ member(piece(_,_,X,Y),Board).
destination(Board,Color,X,Y) :- inside(X,Y), \+ member(piece(Color,_,X,Y),Board), \+ member(piece(_,k,X,Y),Board).

% Ataques geométricos: no llaman al generador legal, evitando recursión con el jaque.
in_check(Board, Color) :- memberchk(piece(Color,k,X,Y),Board), other(Color,Enemy), attacked(Board,Enemy,X,Y).
attacked(Board, Color, X, Y) :- member(piece(Color,Type,FX,FY),Board), attacks(Type,Color,Board,FX,FY,X,Y), !.
attacks(p,Color,_,FX,FY,X,Y) :- pawn_step(Color,D), Y =:= FY+D, abs(X-FX) =:= 1.
attacks(n,_,_,FX,FY,X,Y) :- DX is abs(X-FX), DY is abs(Y-FY), memberchk(DX-DY,[1-2,2-1]).
attacks(k,_,_,FX,FY,X,Y) :- max(abs(X-FX),abs(Y-FY)) =:= 1.
attacks(Type,_,Board,FX,FY,X,Y) :- memberchk(Type,[b,r,q]), line_direction(Type,FX,FY,X,Y,DX,DY), clear_line(Board,FX,FY,X,Y,DX,DY).
line_direction(Type,FX,FY,X,Y,DX,DY) :-
    AX is X-FX, AY is Y-FY, (AX =\= 0 ; AY =\= 0),
    ( Type=b -> abs(AX)=:=abs(AY) ; Type=r -> (AX=:=0 ; AY=:=0) ; (AX=:=0 ; AY=:=0 ; abs(AX)=:=abs(AY)) ),
    DX is sign(AX), DY is sign(AY).
clear_line(Board,FX,FY,X,Y,DX,DY) :- NX is FX+DX, NY is FY+DY,
    ( NX=:=X, NY=:=Y -> true ; empty(Board,NX,NY), clear_line(Board,NX,NY,X,Y,DX,DY) ).

pawn_step(w,1). pawn_step(b,-1).
pawn_start(w,2). pawn_start(b,7).
promotion(w,8,Type) :- member(Type,[q,r,b,n]).
promotion(b,1,Type) :- member(Type,[q,r,b,n]).
promotion(Color,Y,none) :- (Color=w -> Y=\=8 ; Y=\=1).

% Movimientos candidatos, incluidos promoción, enroque y captura al paso.
pseudo(state(Board,Color,_,Ep,_,_), move(FX,FY,X,Y,Promotion,Special)) :-
    member(piece(Color,p,FX,FY),Board), pawn_step(Color,D),
    ( X=FX, Y is FY+D, inside(X,Y), empty(Board,X,Y), Special=normal
    ; X=FX, pawn_start(Color,FY), Mid is FY+D, Y is FY+2*D, empty(Board,X,Mid), empty(Board,X,Y), Special=normal
    ; member(DX,[-1,1]), X is FX+DX, Y is FY+D, inside(X,Y), other(Color,Enemy),
      ( member(piece(Enemy,T,X,Y),Board), T\=k, Special=normal
      ; Ep=sq(X,Y), empty(Board,X,Y), memberchk(piece(Enemy,p,X,FY),Board), Special=en_passant ) ),
    promotion(Color,Y,Promotion).
pseudo(state(Board,Color,_,_,_,_), move(FX,FY,X,Y,none,normal)) :-
    member(piece(Color,Type,FX,FY),Board), memberchk(Type,[n,k]),
    ( Type=n -> member(DX-DY,[1-2,2-1,2-(-1),1-(-2),(-1)-(-2),(-2)-(-1),(-2)-1,(-1)-2])
    ; member(DX-DY,[1-0,1-1,0-1,(-1)-1,(-1)-0,(-1)-(-1),0-(-1),1-(-1)]) ),
    X is FX+DX, Y is FY+DY, destination(Board,Color,X,Y).
pseudo(state(Board,Color,_,_,_,_), move(FX,FY,X,Y,none,normal)) :-
    member(piece(Color,Type,FX,FY),Board), memberchk(Type,[b,r,q]),
    direction(Type,DX,DY), ray(Board,Color,FX,FY,DX,DY,X,Y).
pseudo(state(Board,Color,Rights,_,_,_), move(5,Rank,To,Rank,none,castle(RookFrom,RookTo))) :-
    castle_info(Color,Right,Rank,To,RookFrom,RookTo,Clear,Transit), memberchk(Right,Rights),
    memberchk(piece(Color,k,5,Rank),Board), memberchk(piece(Color,r,RookFrom,Rank),Board),
    forall(member(File,Clear),empty(Board,File,Rank)), \+ in_check(Board,Color),
    select(piece(Color,k,5,Rank),Board,WithoutKing), other(Color,Enemy),
    \+ attacked([piece(Color,k,Transit,Rank)|WithoutKing],Enemy,Transit,Rank).

direction(b,DX,DY) :- member(DX-DY,[1-1,1-(-1),(-1)-1,(-1)-(-1)]).
direction(r,DX,DY) :- member(DX-DY,[1-0,(-1)-0,0-1,0-(-1)]).
direction(q,DX,DY) :- (direction(b,DX,DY);direction(r,DX,DY)).
ray(Board,Color,FX,FY,DX,DY,X,Y) :-
    NX is FX+DX, NY is FY+DY, destination(Board,Color,NX,NY),
    (X=NX,Y=NY ; empty(Board,NX,NY), ray(Board,Color,NX,NY,DX,DY,X,Y)).
castle_info(w,'K',1,7,8,6,[6,7],6).
castle_info(w,'Q',1,3,1,4,[2,3,4],4).
castle_info(b,k,8,7,8,6,[6,7],6).
castle_info(b,q,8,3,1,4,[2,3,4],4).

apply_move(state(Board,Color,Rights,_,Half,Full), move(FX,FY,X,Y,Promo,Special), state(Next,Enemy,NextRights,Ep,NextHalf,NextFull)) :-
    select(piece(Color,Type,FX,FY),Board,Without),
    ( select(piece(_,_,X,Y),Without,Captured) -> Capture=true ; Captured=Without, Capture=false ),
    ( Special=en_passant -> select(piece(_,p,X,FY),Captured,Rest)
    ; Special=castle(RFrom,RTo) -> select(piece(Color,r,RFrom,FY),Captured,Rookless), Rest=[piece(Color,r,RTo,FY)|Rookless]
    ; Rest=Captured ),
    ( Promo=none -> NewType=Type ; NewType=Promo ), Next=[piece(Color,NewType,X,Y)|Rest],
    exclude(lost_right(Color,Type,FX,FY,X,Y),Rights,NextRights),
    ( Type=p, abs(Y-FY)=:=2 -> EY is (Y+FY)//2, Ep=sq(X,EY) ; Ep=none ),
    ( (Type=p ; Capture=true ; Special=en_passant) -> NextHalf=0 ; NextHalf is Half+1 ),
    (Color=b -> NextFull is Full+1 ; NextFull=Full), other(Color,Enemy).
lost_right(Color,k,_,_,_,_,Right) :- castle_info(Color,Right,_,_,_,_,_,_), !.
lost_right(Color,r,FX,FY,_,_,Right) :- castle_info(Color,Right,FY,_,FX,_,_,_), !.
lost_right(_,_,_,_,X,Y,Right) :- castle_info(_,Right,Y,_,X,_,_,_).

legal_move(State,Move,Next) :- State=state(_,Color,_,_,_,_), pseudo(State,Move), apply_move(State,Move,Next), Next=state(Board,_,_,_,_,_), \+ in_check(Board,Color).
legal_moves(State,Moves) :- findall(Move,legal_move(State,Move,_),Moves).

% Negamax: la evaluación cambia de signo al alternar jugador. Alfa-beta corta
% las ramas que ya no pueden superar la mejor opción del adversario.
choose_move(Fen,Depth,Move,Score,Nodes) :-
    fen_state(Fen,State), nb_setval(chess_nodes,0), search(State,Depth,-1000000,1000000,Move,Score), nb_getval(chess_nodes,Nodes).
search(State,Depth,Alpha,Beta,Move,Score) :-
    nb_getval(chess_nodes,N), N1 is N+1, nb_setval(chess_nodes,N1),
    legal_moves(State,Moves), State=state(Board,Color,_,_,Half,_),
    ( Moves=[] -> Move=none, (in_check(Board,Color) -> Score is -100000-Depth ; Score=0)
    ; Half>=100 -> Move=none, Score=0
    ; Depth=:=0 -> Move=none, evaluate(Board,Color,Score)
    ; order_moves(State,Moves,Ordered), D is Depth-1,
      best_moves(Ordered,State,D,Alpha,Beta,none,-1000000,Move,Score) ).
best_moves([],_,_,_,_,Move,Score,Move,Score).
best_moves([Move|Moves],State,D,Alpha,Beta,Previous,PreviousScore,Best,Score) :-
    apply_move(State,Move,Next), NA is -Beta, NB is -Alpha,
    search(Next,D,NA,NB,_,ReplyScore), Value is -ReplyScore,
    ( Value>PreviousScore -> Chosen=Move, Current=Value ; Chosen=Previous, Current=PreviousScore ),
    NextAlpha is max(Alpha,Value),
    (NextAlpha>=Beta -> Best=Chosen, Score=Current
    ; best_moves(Moves,State,D,NextAlpha,Beta,Chosen,Current,Best,Score)).

piece_value(p,100). piece_value(n,320). piece_value(b,330). piece_value(r,500). piece_value(q,900). piece_value(k,0).
evaluate(Board,Color,Score) :-
    findall(Value,(member(piece(C,T,X,Y),Board),piece_value(T,Material),
      Center is 7-abs(2*X-9)-abs(2*Y-9),
      (T=p -> (C=w -> Advance is Y-2 ; Advance is 7-Y), Position is Advance*8
      ; memberchk(T,[n,b]) -> Position is Center*4 ; Position=0),
      (C=Color -> Value is Material+Position ; Value is -Material-Position)),Values), sum_list(Values,Score).
order_moves(state(Board,_,_,_,_,_),Moves,Ordered) :-
    findall(Key-Move,(member(Move,Moves),Move=move(FX,FY,X,Y,Promo,Special),memberchk(piece(_,T,FX,FY),Board),piece_value(T,Attacker),
      (memberchk(piece(_,Victim,X,Y),Board) -> piece_value(Victim,Capture) ; Special=en_passant -> Capture=100 ; Capture=0),
      (Promo=none -> Promotion=0 ; piece_value(Promo,Promotion)), Key is -(Capture*10-Attacker+Promotion)),Pairs),
    keysort(Pairs,Sorted), pairs_values(Sorted,Ordered).

move_json(none, @(null)).
move_json(move(FX,FY,X,Y,Promo,_),Json) :- square_string(FX,FY,From),square_string(X,Y,To),
    (Promo=none -> Json=_{from:From,to:To} ; Json=_{from:From,to:To,promotion:Promo}).

% Recuento exhaustivo de posiciones: permite contrastar las reglas con chess.js.
perft(_,0,1) :- !.
perft(State,Depth,Count) :- D is Depth-1, findall(N,(legal_move(State,_,Next),perft(Next,D,N)),Counts),sum_list(Counts,Count).
