:- use_module(chess).
:- begin_tests(chess_ai).
initial("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").
test(initial_perft) :- initial(F),fen_state(F,S),perft(S,1,20),perft(S,2,400),perft(S,3,8902).
test(kiwipete_castles_pins_perft) :- fen_state("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",S),perft(S,1,48),perft(S,2,2039).
test(endgame_perft) :- fen_state("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",S),perft(S,1,14),perft(S,2,191),perft(S,3,2812).
test(en_passant_pin) :- fen_state("k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",S),legal_moves(S,M),\+ member(move(5,5,4,6,none,en_passant),M).
test(en_passant) :- fen_state("k7/8/8/3pP3/8/8/8/4K3 w - d6 0 1",S),legal_moves(S,M),memberchk(move(5,5,4,6,none,en_passant),M).
test(promotions) :- fen_state("7k/P7/8/8/8/8/8/7K w - - 0 1",S),legal_moves(S,M),findall(P,member(move(1,7,1,8,P,normal),M),[q,r,b,n]).
test(castle_through_check,[fail]) :- fen_state("k4r2/8/8/8/8/8/8/4K2R w K - 0 1",S),legal_moves(S,M),member(move(5,1,7,1,none,castle(8,6)),M).
test(mate_in_one,[nondet]) :- choose_move("rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2",2,move(4,8,8,4,none,normal),Score,Nodes),Score>90000,Nodes>1.
test(check_escape) :- fen_state("4k3/8/8/8/8/8/4R3/4K3 b - - 0 1",S),legal_moves(S,M),M\=[],forall(member(Move,M),(apply_move(S,Move,state(B,_,_,_,_,_)),\+ in_check(B,b))).
test(stalemate) :- choose_move("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",2,none,0,_).
test(invalid_fen,[fail]) :- fen_state("8/8/8/8/8/8/8/8 w - - 0 1",_).
:- end_tests(chess_ai).
