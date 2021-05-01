import pyupbit
import numpy as np

#OHLCV = Open, High, Low, Close, Volumn 당일 시가, 고가, 저가, 종가, 거래량을 의미
df = pyupbit.get_ohlcv("KRW-BTC", count=7)          #df에, count=7일간의 OHLCV를 불러옴

# range = 변동성 돌파 폭 : 변동폭(전일 고가 - 전일 저가) * k계수(매수 지점).
# k계수 작을수록, 조금만 올라도 매수진행
k = 0.5
df['range'] = (df['high'] - df['low']) * k

# target = 당일 변동성 돌파 매수값 : 당일 시가 + 전일 range 값 : .shift(1) 함수를 통해 전일의 range column을 한칸 내림. 
df['target'] = df['open'] + df['range'].shift(1)    

# upbit 거래 수수료
fee = 0.0005

# ror = 수익률  np.where=(조건문, 조건문이 참일때 값, 조건문이 거짓일때 값)
# 조건문 : '당일 고가 > 당일 변동성 돌파 기준값' 일 때 ror인 수익률이 계산된다.
# 조건문이 참일때 값 : ror 수익률 = '당일 종가 / 당일 변동성 돌파 기준값'
# 조건문이 거짓일 때 값 : ror 수익률 = 조건문이 발동되지 않았다는 것은 매수가 되지 않은 것이기 때문에, 수익률은 1이다.
df['ror'] = np.where(df['high'] > df['target'],
                     df['close'] / df['target'] - fee,
                     1)

# hpr = 목표일까지의 누적 수익률로써, 목표일까지의 수익률의 곱으로 표현됨. : .cumprod() 함수.
df['hpr'] = df['ror'].cumprod()

# Draw Down = 하락폭 계산 : (목표일까지의 누적 수익률의 최대값 - 목표일까지의 누적 수익률 / 목표일까지의 누적 수익률 최대값) * 100
df['dd'] = (df['hpr'].cummax() - df['hpr']) / df['hpr'].cummax() * 100

# Max Draw Down
print("MDD(%): ", df['dd'].max()) 

# to_excel 
df.to_excel("dd.xlsx")

