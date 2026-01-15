export default async (req) => {
  const authHeader = req.headers.get('authorization')
  
  if (!authHeader) {
    return new Response(JSON.stringify({ code: -1, msg: '缺少 Authorization' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const response = await fetch('https://aiping.cn/api/v1/user/remain/points', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ code: -1, msg: '请求失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const config = {
  path: '/api/balance'
}
