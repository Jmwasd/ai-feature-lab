import { CanvasView } from './ui/CanvasView'
import { PropertyPanel } from './ui/PropertyPanel'
import { TextEditor } from './ui/TextEditor'
import { Toolbar } from './ui/Toolbar'

export default function App() {
  return (
    <div className="app">
      <Toolbar />
      {/* 텍스트 편집기와 속성 패널은 캔버스 위에 절대 위치로 겹친다 */}
      <div className="stage">
        <CanvasView />
        <TextEditor />
        <PropertyPanel />
      </div>
    </div>
  )
}
