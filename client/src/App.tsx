import { HashRouter, Routes, Route } from 'react-router-dom'
import { UserProvider } from './contexts/UserContext'
import TabBar from './components/TabBar'
import Home from './pages/Home'
import Shelf from './pages/Shelf'
import Create from './pages/Create'
import Messages from './pages/Messages'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import WorkDetail from './pages/WorkDetail'
import CreationTree from './pages/CreationTree'
import Fork from './pages/Fork'

function AppLayout() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shelf" element={<Shelf />} />
        <Route path="/create" element={<Create />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/work/:id" element={<WorkDetail />} />
        <Route path="/work/:id/tree" element={<CreationTree />} />
        <Route path="/fork/:id" element={<Fork />} />
        <Route path="/chat/:id" element={<Chat />} />
      </Routes>
      <TabBar />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <UserProvider>
        <AppLayout />
      </UserProvider>
    </HashRouter>
  )
}
