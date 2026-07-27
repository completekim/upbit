import os
import pyupbit

#주문은 초당 8회, 분당 200회 / 주문 외 요청은 초당 30회, 분당 900회 사용 가능합니다.
access = os.environ["UPBIT_ACCESS_KEY"]      # .env 또는 환경변수에서 읽어옴
secret = os.environ["UPBIT_SECRET_KEY"]
upbit = pyupbit.Upbit(access, secret)


#get_balance 메서드는 입력받은 티커의 보유 수량 정보를 조회합니다.
#print(upbit.get_balance("KRW-XRP"))     # KRW-XRP 조회

print()
  
print('### Only Pure Balance (Excluding the amount waiting to be sold)', '\n')
print('{} = {}'.format("Cash" , upbit.get_balance("KRW")), 'exclude waiting to buy' ,'\n')   
print('{} = {}'.format("VET-balance" , upbit.get_balance("KRW-VET")))   
print('{} = {}'.format("XRP-balance" , upbit.get_balance("KRW-XRP")))   
print('{} = {}'.format("BTC-balance" , upbit.get_balance("KRW-BTC")))   





print()