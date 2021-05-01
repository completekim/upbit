import time
import pyupbit
import datetime

access = "DrWi6CJF2xRTlOix6Upx9kRRt1c4PVgvNkdJHQqY"
secret = "0DexaS0FNkh56fjEPgx3tTP939o7gWmqe6CfMXsB"

def get_target_price(ticker, k):
    """변동성 돌파 전략으로 매수 목표가 조회"""
    df = pyupbit.get_ohlcv(ticker, interval="day", count=2)         # 2일치 OHLCV 불러옴
    target_price = df.iloc[0]['close'] + (df.iloc[0]['high'] - df.iloc[0]['low']) * k  # 오늘의 종가 = 내일의 시가 + 당일 변동성 돌파 매수값           
    return target_price

def get_start_time(ticker):
    """시작 시간 조회"""
    df = pyupbit.get_ohlcv(ticker, interval="day", count=1)         # interval = 일봉을 기준으로 ohlcv를 받아옴. 
    start_time = df.index[0]         # df.index[0] = 2021-05-01 09:00:00 과 같은 날짜정보
    return start_time

def get_balance(ticker):
    """잔고 조회"""
    balances = upbit.get_balances()
    for b in balances:
        if b['currency'] == ticker:
            if b['balance'] is not None:
                return float(b['balance'])
            else:
                return 0

def get_current_price(ticker):
    """현재가 조회"""
    return pyupbit.get_orderbook(tickers=ticker)[0]["orderbook_units"][0]["ask_price"]

# 로그인
upbit = pyupbit.Upbit(access, secret)
print("autotrade start")

# 자동매매 시작 (무한루프)
# try, except : 오류가 발생하면 수정
while True:         
    try:
        now = datetime.datetime.now()
        start_time = get_start_time("KRW-BTC")
        end_time = start_time + datetime.timedelta(days=1)  # endtime = start_time + 24시간인 다음날 9시

        if start_time < now < end_time - datetime.timedelta(seconds=10):    # if 문이 동작하는 시간 : 시작일9시 ~ 다음날8시59분50초 
            target_price = get_target_price("KRW-BTC", 0.5)
            current_price = get_current_price("KRW-BTC")
            if target_price < current_price:
                krw = get_balance("KRW")
                if krw > 5000:
                    upbit.buy_market_order("KRW-BTC", krw*0.9995)           # 수수료 0.05% 제외
        else:
            btc = get_balance("BTC")
        
            # 21.05.01 : 1BTC = 69,109,000 원, 0.00008 BTC = 5,529원, 만약 5천원 미만이면, else가 시행되지 못하는데 5천원 미만이기 어려움  
            if btc > 0.00008:       
                upbit.sell_market_order("KRW-BTC", btc*0.9995)
        time.sleep(1)
    except Exception as e:
        print(e)
        time.sleep(1)