FROM swipl:9.2.9
WORKDIR /app
COPY chess.pl server.pl tests.pl ./
RUN swipl -q -g run_tests -t halt tests.pl
EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=6 CMD swipl -q -g "use_module(library(http/http_open)),setup_call_cleanup(http_open('http://127.0.0.1:8082/api/prolog/health',S,[]),read_string(S,_,_),close(S)),halt" -t 'halt(1)'
CMD ["swipl", "-q", "server.pl"]
