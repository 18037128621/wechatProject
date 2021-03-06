const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    currIndex: 0,
    currOrderList: [],
    scrollTop: 0,
    triggerRefresh: false,
    tabs: [
      { title: '全部', id: 0 },
      { title: '待付款', id: 1 },
      { title: '已完成', id: 2 },
      { title: '已取消', id: 3 }
    ]
  },
  hasClickPay: false,
  orderLists: [],
  oldScrollTops: [],
  isSwitchTab: false,
  userInfo: '',

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: async function (options) {
    this.userInfo = app.getUserInfo();
    if (!this.userInfo) {
      wx.showToast({
        title: '请先登录哦',
        icon: 'none',
        duration: 1000
      });
      return;
    }
    const res = await this.getOrderRecored();
    this.orderLists[0] = res;
  },

  // 获取订单记录
  async getOrderRecored(query) {
    wx.showLoading({
      title: '加载中...',
      mask: true,
    });
    const res  = await wx.cloud.callFunction({
      name: 'queryOrder',
      data: query
    });
    wx.hideLoading();
    if (!res) {
      wx.showToast({
        title: '数据加载失败，请稍后重试',
        icon: 'none',
        duration: 1000,
        mask: true,
      });
    }
    const { list: data } = res.result;
    data.forEach(order => {
      if (order.orderStatus === 0 && order.orderExpired <=0) {
        const { expireTime } = order;
        const now = new Date().getTime();
        const diffTime = expireTime - now;
        order.remainTime = Math.floor(diffTime /  (60 * 60 * 1000)) + '小时' + Math.floor((diffTime % (60 * 60 * 1000)) / (60 * 1000)) + '分';
    }
    });
    this.setData({
      currOrderList: data
    });
    return data;
  },

  // 切换tab
  async switchTab(e) {
    const { tabindex } = e.currentTarget.dataset;
    if (tabindex === this.data.currIndex) return;
    if (!app.getUserInfo()) {
      wx.showToast({
        title: '请先登录哦',
        icon: 'none',
        duration: 1000,
        mask: true
      });
      return;
    }
    this.isSwitchTab = true;
    const cacheScrollTop = this.oldScrollTops[tabindex];
    let res = this.orderLists[tabindex];
    this.setData({
      currIndex: tabindex
    });
    if (!res) {
      res = await this.getOrderRecored({
        orderStatus: tabindex - 1
      });
      this.orderLists[tabindex] = res;
    }
    this.setData({
      currOrderList: res
    },() => {
      this.setData({
        scrollTop: cacheScrollTop || 0
      })
    });
  },

  // 去付款
  async toPay(e) {
    if (this.hasClickPay ) {
      return;
    }
    const { expireTime, payment: { timeStamp, nonceStr, package: payPackage, signType, paySign } } = e.currentTarget.dataset;
    if (new Date().getTime() - expireTime >= 0) {
      wx.showToast({
        title: '订单已取消',
        icon: 'none',
        duration: 1000,
        mask: true
      });
      wx.reLaunch({
        url: '/pages/order/order'
      });
    }
    wx.showLoading({
      title: '加载中...',
      mask: true,
    });
    this.hasClickPay = true;
    const res = await app.requestPayment({
      timeStamp,
      nonceStr,
      package: payPackage,
      signType,
      paySign
    });

    wx.hideLoading();
    this.hasClickPay = false;
    if (res === 0) {
      wx.reLaunch({
        url: '/pages/order/order',
      });
    } else if (res === 2) {
      wx.showToast({
        title: '支付失败，请稍后重试',
        icon: 'none',
        duration: 1000,
        mask: true,
      });
    }
  },

  // 去订单详情
  goOrderDetail(e) {
    const { orderno } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/orderDetail/orderDetail?orderNo=${orderno}`,
    });
  },

  //监听滚动
  scroll(e) {
    if (this.isSwitchTab) {
      return;
    }
    const { scrollTop } = e.detail;
    this.oldScrollTops[this.data.currIndex] = scrollTop;
  },

  touchstart() {
    this.isSwitchTab = false;
  },

  // 再来一单
  orderAgain(e) {
    const { order } = e.currentTarget.dataset;
    let newOrder = JSON.stringify({
      productList: order.foodList,
      totalMoney: order.totalFee,
    });
    wx.navigateTo({
      url: `/pages/confirmorder/confirmorder?dishList=${newOrder}`,
    });
  },

  async refresh() {
    let status = null;
    if (this.data.currIndex) {
      status = this.data.currIndex - 1;
    }
    const res = await this.getOrderRecored({
      orderStatus: status
    });
    this.orderLists[this.data.currIndex] = res;
    this.setData({
      triggerRefresh: false,
    })
  },

  // 去首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index',
    });
  }
})