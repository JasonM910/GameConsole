:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(time)).
:- use_module(chess).

:- http_handler(root('api/prolog/health'), health, [method(get)]).
:- http_handler(root('api/prolog/move'), move_handler, [method(post)]).

health(_) :- reply_json_dict(_{status:ok,engine:'SWI-Prolog',algorithm:'negamax-alpha-beta'}).
move_handler(Request) :- catch(move_request(Request),Error,error_reply(Error)).
move_request(Request) :-
    (memberchk(content_length(Size),Request), Size>4096 -> throw(error(invalid_request,_)) ; true),
    http_read_json_dict(Request,Data),
    (is_dict(Data), get_dict(fen,Data,Fen), fen_state(Fen,_) -> true ; throw(error(invalid_fen,_))),
    (get_dict(depth,Data,Depth) -> true ; Depth=2),
    (integer(Depth),between(1,3,Depth) -> true ; throw(error(invalid_depth,_))),
    call_with_time_limit(8,choose_move(Fen,Depth,Move,Score,Nodes)), move_json(Move,Json),
    reply_json_dict(_{fen:Fen,move:Json,search:_{algorithm:'negamax-alpha-beta',depth:Depth,score:Score,nodes:Nodes}}).
error_reply(time_limit_exceeded) :- !, reply_json_dict(_{error:_{message:'Prolog agotó el tiempo de búsqueda. Reintenta la jugada.'}},[status(504)]).
error_reply(Error) :- print_message(warning,Error), reply_json_dict(_{error:_{message:'Solicitud inválida: se requiere FEN válido y profundidad entre 1 y 3.'}},[status(400)]).

main :-
    (getenv('PROLOG_PORT',Text) -> atom_number(Text,Port) ; Port=8082),
    http_server(http_dispatch,[port(Port),workers(4),timeout(15)]),
    format(user_error,'Prolog listening on ~w~n',[Port]), thread_get_message(stop).
:- initialization(main, main).
