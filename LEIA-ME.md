# Módulo Entregas — pacote COMPLETO (v12)

Pasta `src/entregas` inteira (16 arquivos) + os dois geradores de PDF.
Substitua as pastas e o módulo fica completo, sem chance de ficar pela metade.

Nada de Firebase. Nada de App.jsx.

Confirme o selo **"Entregas v12"** no canto da barra de abas depois do deploy.

---

## 1. Opção mensal nos períodos

**Fechamentos e Repasses** ganharam uma terceira aba: além de 01–15 e 16–31,
agora existe **Mês inteiro**. Serve para o lojista ou motoboy que você prefere
fechar de uma vez só.

**Histórico do motoboy** ganhou o par de botões **Por quinzena / Mensal**.
No modo mensal, as duas quinzenas viram uma linha só, com entregas, valores e
tarifa média recalculados sobre o mês.

### Uma correção que veio junto

A tela de fechamentos não descartava coletas já fechadas em outro período.
Com quinzena isso nunca aparecia, mas com "Mês inteiro" o que já foi cobrado
na primeira quinzena seria contado de novo. Agora uma coleta só aparece no
período do fechamento a que pertence.

---

## 2. Confirmação em toda ação destrutiva

Auditei o módulo inteiro. Estas oito ações agora pedem confirmação:

| Onde | Ação | Já tinha? |
|---|---|---|
| Motoboys | Excluir motoboy | sim |
| Motoboys | **Revogar convite** | não |
| Lojistas | Excluir lojista | sim |
| Bases | Excluir base | sim |
| Base & Triagem | **Excluir rota** | não |
| Repasses | **Estornar pagamento** | não |
| Histórico do lojista | **Estornar recebimento** | não |
| Fechamentos | **Reabrir fechamento** | não |
| Configurações | **Remover região / marketplace** | não |

Cada aviso explica a consequência real, não só "tem certeza?". O de revogar
convite, por exemplo, esclarece que quem já criou a conta continua com acesso
— para tirar o acesso é preciso remover a pessoa em Configurações → Equipe.

---

## 3. Configurações — aviso de alterações não salvas

Ao lado do botão Salvar agora aparece **"Alterações só valem depois de
salvar"**. Era a causa mais provável da impressão de que a tela estava
travada: o botão **+** monta a lista, mas nada vai para a nuvem sem salvar.

Se depois de clicar em Salvar continuar não gravando, abra o console (F12) e
me mande o erro.
